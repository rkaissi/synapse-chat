import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import toast from "react-hot-toast";

interface Props {
    onRepoSelect: (repoUrl: string) => void;
}

const GitHubRepoSelector = ({ onRepoSelect }: Props) => {
    const [repoUrl, setRepoUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const validateGitHubUrl = (url: string) => {
        try {
            const parsedUrl = new URL(url);
            return (
                parsedUrl.hostname === "github.com" &&
                parsedUrl.pathname.split("/").filter(Boolean).length >= 2
            );
        } catch {
            return false;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateGitHubUrl(repoUrl)) {
            toast.error("Please enter a valid GitHub repository URL");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch("/api/github", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ repoUrl })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to load repository");
            }

            onRepoSelect(repoUrl);
            toast.success("Repository connected successfully!");
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
        <div className="w-full max-w-2xl mx-auto p-4">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <Input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/owner/repository"
                    className="grow"
                    disabled={isLoading}
                />
                <Button
                    type="submit"
                    disabled={isLoading}
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
