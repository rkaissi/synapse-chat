import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GitHubLogoIcon, Cross2Icon, LockClosedIcon } from "@radix-ui/react-icons";
import toast from "react-hot-toast";
import { RepoConnection } from "@/lib/types";

interface Props {
    connection: RepoConnection | null;
    onConnect: (connection: RepoConnection) => void;
    onDisconnect: () => void;
}

const GitHubRepoSelector = ({ connection, onConnect, onDisconnect }: Props) => {
    const [repoUrl, setRepoUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!repoUrl.trim()) {
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch("/api/github", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ repoUrl })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to connect repository");
            }

            onConnect(data.connection);
            setRepoUrl("");
            toast.success(
                `Connected ${data.connection.owner}/${data.connection.repo}`
            );
        } catch (error) {
            console.error("Error connecting repository:", error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to connect repository"
            );
        } finally {
            setIsLoading(false);
        }
    };

    if (connection) {
        return (
            <div className="w-full max-w-2xl mx-auto px-4 py-2">
                <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm w-fit max-w-full">
                    <GitHubLogoIcon className="w-4 h-4 shrink-0" />
                    <a
                        href={`https://github.com/${connection.owner}/${connection.repo}/tree/${connection.sha}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium truncate hover:underline"
                    >
                        {connection.owner}/{connection.repo}
                    </a>
                    {connection.isPrivate && (
                        <LockClosedIcon className="w-3 h-3 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground truncate">
                        {connection.ref} · {connection.sha.slice(0, 7)} ·{" "}
                        {connection.fileCount} files
                    </span>
                    <button
                        type="button"
                        onClick={onDisconnect}
                        className="ml-1 rounded-full p-0.5 hover:bg-accent"
                        aria-label="Disconnect repository"
                    >
                        <Cross2Icon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto p-4">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <Input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="github.com/owner/repo, owner/repo or .../tree/branch"
                    className="grow"
                    disabled={isLoading}
                />
                <Button
                    type="submit"
                    disabled={isLoading || !repoUrl.trim()}
                    className="whitespace-nowrap"
                >
                    <GitHubLogoIcon className="w-4 h-4 mr-2" />
                    {isLoading ? "Connecting..." : "Connect Repository"}
                </Button>
            </form>
        </div>
    );
};

export default GitHubRepoSelector;
