import { gunzipSync } from "zlib";
import { RepoConnection } from "@/lib/types";

// A connected repository is downloaded once as a tarball (a shallow "clone" of one
// commit) and kept in memory, so the model can list, read and grep files quickly
// through tools instead of having the whole repo pasted into the conversation.

const GITHUB_API = "https://api.github.com";
const MAX_TARBALL_BYTES = 150 * 1024 * 1024;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_CACHED_REPOS = 5;

const IGNORED_DIRECTORIES = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "coverage",
    ".cache",
    ".turbo",
    "vendor",
    "__pycache__",
    ".venv",
    "venv"
]);

export interface RepoFile {
    path: string;
    size: number;
    // undefined for binary or oversized files
    content?: string;
}

export interface RepoSnapshot {
    connection: RepoConnection;
    description: string | null;
    files: Map<string, RepoFile>;
    readme?: string;
}

const snapshots = new Map<string, RepoSnapshot>();
const pendingSnapshots = new Map<string, Promise<RepoSnapshot>>();

const githubHeaders = (accept = "application/vnd.github+json") => ({
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "SynapseChat",
    ...(process.env.GITHUB_ACCESS_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_ACCESS_TOKEN}` }
        : {})
});

const githubFetch = async (path: string, accept?: string) => {
    const response = await fetch(`${GITHUB_API}${path}`, {
        headers: githubHeaders(accept)
    });
    if (!response.ok) {
        const reason =
            response.status === 404
                ? "Repository or branch not found (private repositories need GITHUB_ACCESS_TOKEN with access)"
                : response.status === 403 || response.status === 429
                  ? "GitHub rate limit reached or access denied"
                  : `GitHub request failed with status ${response.status}`;
        throw new Error(reason);
    }
    return response;
};

/**
 * Accepts https URLs (optionally with .git, /tree/<ref>), git@github.com:owner/repo.git
 * and the owner/repo shorthand.
 */
export const parseRepoUrl = (
    input: string
): { owner: string; repo: string; ref?: string } | null => {
    const value = input.trim();
    const ssh = value.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
    if (ssh) {
        return { owner: ssh[1], repo: ssh[2] };
    }
    const shorthand = value.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
    if (shorthand) {
        return { owner: shorthand[1], repo: shorthand[2] };
    }
    try {
        const url = new URL(value.startsWith("http") ? value : `https://${value}`);
        if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
            return null;
        }
        const [owner, repo, kind, ...rest] = url.pathname
            .split("/")
            .filter(Boolean);
        if (!owner || !repo) {
            return null;
        }
        return {
            owner,
            repo: repo.replace(/\.git$/, ""),
            ref: kind === "tree" && rest.length > 0 ? rest.join("/") : undefined
        };
    } catch {
        return null;
    }
};

const readString = (buffer: Buffer, start: number, length: number) => {
    const end = buffer.indexOf(0, start);
    return buffer.toString(
        "utf8",
        start,
        end === -1 || end > start + length ? start + length : end
    );
};

const parsePaxPath = (data: Buffer) => {
    for (const record of data.toString("utf8").split("\n")) {
        const match = record.match(/^\d+ path=(.*)$/);
        if (match) {
            return match[1];
        }
    }
    return undefined;
};

// Minimal ustar/pax reader, enough for GitHub tarballs
function* readTar(buffer: Buffer) {
    let offset = 0;
    let nextPath: string | undefined;
    while (offset + 512 <= buffer.length) {
        const header = buffer.subarray(offset, offset + 512);
        if (header.every((byte) => byte === 0)) {
            break;
        }
        const name = readString(header, 0, 100);
        const size = parseInt(readString(header, 124, 12).trim() || "0", 8);
        const type = String.fromCharCode(header[156]);
        const prefix = readString(header, 345, 155);
        const data = buffer.subarray(offset + 512, offset + 512 + size);
        offset += 512 + Math.ceil(size / 512) * 512;

        if (type === "x") {
            nextPath = parsePaxPath(data);
            continue;
        }
        if (type === "L") {
            nextPath = readString(data, 0, size);
            continue;
        }
        if (type === "g") {
            continue;
        }

        const path = nextPath ?? (prefix ? `${prefix}/${name}` : name);
        nextPath = undefined;
        if (type === "0" || type === "\0") {
            yield { path, data };
        }
    }
}

const isBinary = (data: Buffer) =>
    data.subarray(0, 8000).includes(0);

const buildSnapshot = async (
    owner: string,
    repo: string,
    requestedRef?: string
): Promise<RepoSnapshot> => {
    const info = await (await githubFetch(`/repos/${owner}/${repo}`)).json();
    const ref = requestedRef || info.default_branch;
    const sha = (
        await (
            await githubFetch(
                `/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`,
                "application/vnd.github.sha"
            )
        ).text()
    ).trim();

    const cacheKey = `${owner}/${repo}@${sha}`.toLowerCase();
    const cached = snapshots.get(cacheKey);
    if (cached) {
        return cached;
    }

    const tarball = await githubFetch(`/repos/${owner}/${repo}/tarball/${sha}`);
    const compressed = Buffer.from(await tarball.arrayBuffer());
    if (compressed.length > MAX_TARBALL_BYTES) {
        throw new Error("Repository is too large to connect");
    }

    const files = new Map<string, RepoFile>();
    for (const entry of readTar(gunzipSync(compressed))) {
        // Strip GitHub's "<owner>-<repo>-<sha>/" root folder
        const path = entry.path.split("/").slice(1).join("/");
        if (!path || path.split("/").some((part) => IGNORED_DIRECTORIES.has(part))) {
            continue;
        }
        const readable =
            entry.data.length <= MAX_FILE_BYTES && !isBinary(entry.data);
        files.set(path, {
            path,
            size: entry.data.length,
            content: readable ? entry.data.toString("utf8") : undefined
        });
    }

    const readmePath = [...files.keys()].find((path) =>
        /^readme(\.\w+)?$/i.test(path)
    );

    const snapshot: RepoSnapshot = {
        connection: {
            owner: info.owner.login,
            repo: info.name,
            ref,
            sha,
            defaultBranch: info.default_branch,
            isPrivate: info.private,
            fileCount: files.size
        },
        description: info.description,
        files,
        readme: readmePath ? files.get(readmePath)?.content : undefined
    };

    snapshots.set(cacheKey, snapshot);
    while (snapshots.size > MAX_CACHED_REPOS) {
        snapshots.delete(snapshots.keys().next().value!);
    }
    return snapshot;
};

/**
 * Returns the in-memory snapshot of a repository, downloading it if needed.
 * Pass the sha of an existing connection to pin it to the same commit.
 */
export const getRepoSnapshot = async (
    owner: string,
    repo: string,
    ref?: string
): Promise<RepoSnapshot> => {
    const key = `${owner}/${repo}@${ref ?? ""}`.toLowerCase();
    if (/^[0-9a-f]{40}$/i.test(ref ?? "")) {
        const cached = snapshots.get(key);
        if (cached) {
            return cached;
        }
    }
    let pending = pendingSnapshots.get(key);
    if (!pending) {
        pending = buildSnapshot(owner, repo, ref).finally(() =>
            pendingSnapshots.delete(key)
        );
        pendingSnapshots.set(key, pending);
    }
    return pending;
};

const normalizePath = (path?: string) =>
    (path ?? "").trim().replace(/^\.?\/+/, "").replace(/\/+$/, "");

export const listFiles = (
    snapshot: RepoSnapshot,
    path?: string,
    recursive = false,
    limit = 400
) => {
    const base = normalizePath(path);
    const prefix = base ? `${base}/` : "";
    const entries = new Set<string>();
    for (const filePath of snapshot.files.keys()) {
        if (!filePath.startsWith(prefix)) {
            continue;
        }
        const rest = filePath.slice(prefix.length);
        if (recursive) {
            entries.add(filePath);
        } else {
            const [first, ...more] = rest.split("/");
            entries.add(more.length > 0 ? `${prefix}${first}/` : filePath);
        }
    }
    const sorted = [...entries].sort();
    return {
        path: base || ".",
        entries: sorted.slice(0, limit),
        truncated: sorted.length > limit,
        total: sorted.length
    };
};

export const readFile = (
    snapshot: RepoSnapshot,
    path: string,
    startLine = 1,
    endLine?: number
) => {
    const file = snapshot.files.get(normalizePath(path));
    if (!file) {
        return { error: `File not found: ${path}` };
    }
    if (file.content === undefined) {
        return {
            error: `${path} is binary or larger than ${MAX_FILE_BYTES / 1024} KB (${file.size} bytes)`
        };
    }
    const lines = file.content.split("\n");
    const start = Math.max(1, startLine);
    const end = Math.min(lines.length, endLine ?? start + 499);
    return {
        path: file.path,
        startLine: start,
        endLine: end,
        totalLines: lines.length,
        content: lines
            .slice(start - 1, end)
            .map((line, index) => `${start + index}\t${line}`)
            .join("\n")
    };
};

const globToRegExp = (glob: string) =>
    new RegExp(
        "^" +
            glob
                .replace(/[.+^${}()|[\]\\]/g, "\\$&")
                .replace(/\*\*\/?/g, "\u0000")
                .replace(/\*/g, "[^/]*")
                .replace(/\?/g, "[^/]")
                .replace(/\u0000/g, ".*") +
            "$"
    );

export const searchFiles = (
    snapshot: RepoSnapshot,
    pattern: string,
    options: { glob?: string; isRegex?: boolean; caseSensitive?: boolean; maxResults?: number } = {}
) => {
    const { glob, isRegex = false, caseSensitive = false, maxResults = 100 } = options;
    let matcher: RegExp;
    try {
        matcher = new RegExp(
            isRegex ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            caseSensitive ? "" : "i"
        );
    } catch {
        return { error: `Invalid regular expression: ${pattern}` };
    }
    const pathFilter = glob ? globToRegExp(glob) : undefined;

    const matches: string[] = [];
    let total = 0;
    for (const file of snapshot.files.values()) {
        if (file.content === undefined || (pathFilter && !pathFilter.test(file.path))) {
            continue;
        }
        const lines = file.content.split("\n");
        for (let index = 0; index < lines.length; index++) {
            if (matcher.test(lines[index])) {
                total++;
                if (matches.length < maxResults) {
                    matches.push(`${file.path}:${index + 1}: ${lines[index].trim().slice(0, 200)}`);
                }
            }
        }
    }
    return { matches, total, truncated: total > matches.length };
};

// Short overview for the system prompt; details are fetched with the tools
export const describeRepo = (snapshot: RepoSnapshot) => {
    const { owner, repo, ref, sha, fileCount } = snapshot.connection;
    const topLevel = listFiles(snapshot, "", false, 200).entries;
    const readme = snapshot.readme
        ? snapshot.readme.slice(0, 3000) +
          (snapshot.readme.length > 3000 ? "\n…(truncated, read README for more)" : "")
        : "No README found.";
    return `
<connected_repository>
The user connected the GitHub repository ${owner}/${repo} (ref: ${ref}, commit ${sha.slice(0, 7)}, ${fileCount} files).
${snapshot.description ? `Description: ${snapshot.description}\n` : ""}
Explore it like a coding agent working in a local checkout: use repo_list_files to browse directories, repo_search to grep for symbols or text, and repo_read_file to read the relevant code before answering. Do not guess file contents. Cite files as path:line.

Top-level entries:
${topLevel.join("\n")}

README excerpt:
${readme}
</connected_repository>
`;
};
