import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLinkIcon, GlobeIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { extractTitleFromArticle } from "@/lib/utils/format";
import markdownToHtml from "@/lib/utils/markdown-to-html";

interface ReadUrlCardProps {
    result: string;
    url: string;
    returnFormat?: "text" | "html" | "markdown" | "screenshot";
}

const ReadUrlCard: React.FC<ReadUrlCardProps> = ({
    result,
    url,
    returnFormat = "text"
}) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Parse the result string
    const { title, publishedTime, content, processedContent, previewContent } =
        useMemo(() => {
            // Handle screenshot mode separately
            if (returnFormat === "screenshot") {
                return {
                    title: "Page Screenshot",
                    publishedTime: null,
                    content: result,
                    processedContent: `<img src="${result}" alt="Screenshot of the webpage" style="max-width: 100%; height: auto;">`,
                    previewContent: "Screenshot available. Click to view."
                };
            }

            const lines = result.split("\n");

            // Title
            const title = extractTitleFromArticle(lines);
            const truncatedTitle =
                title.slice(0, 100) + (title.length > 100 ? "..." : "");

            // Time
            const publishedTimeLine = lines.find((line) =>
                line.startsWith("Published Time:")
            );
            let publishedTime = publishedTimeLine
                ? new Date(
                      publishedTimeLine.replace("Published Time:", "").trim()
                  )
                : null;
            if (publishedTime && isNaN(publishedTime.getTime())) {
                publishedTime = null; // Set to null if date is invalid
            }

            const content = lines
                .slice(6)
                .join("\n")
                .replace("Markdown Content:", "")
                .trim();

            let processedContent: string;
            let previewContent: string;

            switch (returnFormat) {
                case "html":
                    processedContent = content;
                    previewContent =
                        content.replace(/<[^>]*>/g, "").slice(0, 150) + "...";
                    break;
                case "markdown":
                    processedContent = markdownToHtml(content);
                    previewContent = content.slice(0, 150) + "...";
                    break;
                default: // 'text'
                    processedContent = content;
                    previewContent = content.slice(0, 150) + "...";
            }

            return {
                title: truncatedTitle,
                publishedTime,
                content,
                processedContent,
                previewContent
            };
        }, [result, returnFormat]);

    // Function to safely get hostname
    const getHostname = useMemo(() => {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }, [url]);

    return (
        <>
            <Card className="w-full">
                <CardContent className="p-4">
                    <h3 className="text-xl font-semibold mb-2">{title}</h3>
                    {publishedTime && (
                        <p className="text-sm text-gray-500 mb-1">
                            Published: {publishedTime.toLocaleString()}
                        </p>
                    )}
                    <Link
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center mb-4"
                    >
                        View original article
                        <ExternalLinkIcon className="inline ml-1 w-4 h-4" />
                    </Link>
                    <p className="text-sm text-gray-600 mb-4">
                        {previewContent}
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDialogOpen(true)}
                        className="w-full"
                    >
                        {returnFormat === "screenshot"
                            ? "View Screenshot"
                            : "Read full content"}
                    </Button>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogTitle className="text-lg font-semibold">
                        {title}
                    </DialogTitle>
                    <DialogDescription className="flex items-center">
                        <GlobeIcon className="w-6 h-6 text-gray-500 mr-2" />
                        <span className="text-sm font-medium truncate">
                            {getHostname}
                        </span>
                    </DialogDescription>
                    <div className="grow overflow-auto">
                        <div className="flex flex-col h-full w-full">
                            {returnFormat === "screenshot" ? (
                                <Image
                                    src={content}
                                    alt="Screenshot of the webpage"
                                    style={{ maxWidth: "100%", height: "auto" }}
                                />
                            ) : (
                                <div
                                    className="prose max-w-none p-4 overflow-auto"
                                    dangerouslySetInnerHTML={{
                                        __html: processedContent
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default React.memo(ReadUrlCard);
