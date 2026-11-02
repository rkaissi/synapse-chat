import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import {
    GitHubLogoIcon,
    LockClosedIcon,
    ExternalLinkIcon
} from "@radix-ui/react-icons";
import toast from "react-hot-toast";
import { RepoConnection } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
    connection: RepoConnection | null;
    onConnect: (connection: RepoConnection) => void;
    onDisconnect: () => void;
}

// Compact repository control for the message box: a GitHub button that opens
// a connect form, or a chip with the connected repository and its details
const GitHubRepoSelector = ({ connection, onConnect, onDisconnect }: Props) => {
    const [open, setOpen] = useState(false);
    const [repoUrl, setRepoUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // The popover renders inside the message form; don't submit that too
        e.stopPropagation();
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
            setOpen(false);
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

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    title={
                        connection
                            ? `${connection.owner}/${connection.repo}`
                            : "Connect a GitHub repository"
                    }
                    aria-label={
                        connection
                            ? `Repository ${connection.owner}/${connection.repo}`
                            : "Connect a GitHub repository"
                    }
                    className={cn(
                        "flex h-8 items-center gap-1.5 rounded-full text-xs transition-colors",
                        connection
                            ? "max-w-[9rem] border bg-background px-2.5 text-foreground hover:bg-muted sm:max-w-[12rem]"
                            : "w-8 justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    <GitHubLogoIcon className="h-4 w-4 shrink-0" />
                    {connection && (
                        <span className="truncate font-medium">
                            {connection.repo}
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                side="top"
                className="w-80 p-3"
                // Radix focuses the popover itself; put the cursor in the input
                onOpenAutoFocus={(event) => {
                    const input = (event.currentTarget as HTMLElement | null)?.querySelector("input");
                    if (input) {
                        event.preventDefault();
                        input.focus();
                    }
                }}
            >
                {connection ? (
                    <div className="space-y-3">
                        <div>
                            <div className="flex items-center gap-1.5 text-sm font-medium">
                                <GitHubLogoIcon className="h-4 w-4 shrink-0" />
                                <span className="truncate">
                                    {connection.owner}/{connection.repo}
                                </span>
                                {connection.isPrivate && (
                                    <LockClosedIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                                )}
                                <a
                                    href={`https://github.com/${connection.owner}/${connection.repo}/tree/${connection.sha}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ml-auto text-muted-foreground hover:text-foreground"
                                    aria-label="Open on GitHub"
                                >
                                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                                </a>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {connection.ref} · {connection.sha.slice(0, 7)} ·{" "}
                                {connection.fileCount} files
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            The assistant can list, read and search this
                            commit&apos;s files.
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                                onDisconnect();
                                setOpen(false);
                            }}
                        >
                            Disconnect
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-2">
                        <p className="text-sm font-medium">
                            Connect a GitHub repository
                        </p>
                        <Input
                            type="text"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            placeholder="owner/repo or github.com/owner/repo"
                            disabled={isLoading}
                        />
                        <p className="text-xs text-muted-foreground">
                            Add <code>/tree/branch</code> to connect a branch.
                        </p>
                        <Button
                            type="submit"
                            size="sm"
                            className="w-full"
                            disabled={isLoading || !repoUrl.trim()}
                        >
                            {isLoading ? "Connecting…" : "Connect"}
                        </Button>
                    </form>
                )}
            </PopoverContent>
        </Popover>
    );
};

export default GitHubRepoSelector;
