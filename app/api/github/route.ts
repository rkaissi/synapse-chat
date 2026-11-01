import { NextResponse } from "next/server";
import { getRepoSnapshot, parseRepoUrl } from "@/lib/github/repo";

export const maxDuration = 60;

// Connects a repository: downloads one commit into the in-memory cache and
// returns the connection details the client stores with the chat
export async function POST(req: Request) {
    try {
        const { repoUrl } = await req.json();
        const parsed = typeof repoUrl === "string" ? parseRepoUrl(repoUrl) : null;
        if (!parsed) {
            return NextResponse.json(
                { error: "Enter a GitHub repository URL or owner/repo" },
                { status: 400 }
            );
        }

        const snapshot = await getRepoSnapshot(
            parsed.owner,
            parsed.repo,
            parsed.ref
        );

        return NextResponse.json({
            connection: snapshot.connection,
            description: snapshot.description
        });
    } catch (error) {
        console.error("GitHub API Error:", error);
        const message =
            error instanceof Error ? error.message : "Failed to connect repository";
        return NextResponse.json(
            { error: message },
            { status: message.includes("not found") ? 404 : 502 }
        );
    }
}
