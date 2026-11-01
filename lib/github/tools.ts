import { tool } from "ai";
import { z } from "zod";
import { listFiles, readFile, RepoSnapshot, searchFiles } from "./repo";

// Tools for exploring a connected repository, bound to one snapshot
export const createRepoTools = (snapshot: RepoSnapshot) => ({
    repo_list_files: tool({
        description:
            "List files and directories in the connected GitHub repository. Directories end with '/'. Use recursive to list everything below a path.",
        inputSchema: z.object({
            path: z
                .string()
                .optional()
                .describe("Directory path relative to the repository root. Omit for the root."),
            recursive: z
                .boolean()
                .optional()
                .describe("List all files below the path instead of one level.")
        }),
        execute: async ({ path, recursive }) =>
            listFiles(snapshot, path, recursive ?? false)
    }),
    repo_read_file: tool({
        description:
            "Read a file from the connected GitHub repository. Returns numbered lines (up to 500 per call); use startLine/endLine to page through long files.",
        inputSchema: z.object({
            path: z.string().describe("File path relative to the repository root."),
            startLine: z.number().int().min(1).optional(),
            endLine: z.number().int().min(1).optional()
        }),
        execute: async ({ path, startLine, endLine }) =>
            readFile(snapshot, path, startLine, endLine)
    }),
    repo_search: tool({
        description:
            "Search file contents in the connected GitHub repository (like grep). Returns matching lines as path:line: text.",
        inputSchema: z.object({
            pattern: z.string().describe("Text or regular expression to search for."),
            isRegex: z.boolean().optional(),
            caseSensitive: z.boolean().optional(),
            glob: z
                .string()
                .optional()
                .describe("Only search paths matching this glob, e.g. 'src/**/*.ts'.")
        }),
        execute: async ({ pattern, isRegex, caseSensitive, glob }) =>
            searchFiles(snapshot, pattern, { isRegex, caseSensitive, glob })
    })
});
