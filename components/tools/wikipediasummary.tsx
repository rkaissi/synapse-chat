import { Card, CardContent } from "@/components/ui/card";
import { ExternalLinkIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface WikipediaSummaryCardProps {
    summary: {
        title: string;
        extract: string;
        thumbnail?: {
            source: string;
        };
        content_urls: {
            desktop: {
                page: string;
            };
        };
    };
}

const WikipediaSummaryCard: React.FC<WikipediaSummaryCardProps> = ({
    summary
}) => {
    return (
        <Card className="w-full">
            <CardContent className="p-4">
                <div className="flex items-start space-x-4">
                    <div className="relative h-16 w-16 shrink-0 mt-1">
                        <Image
                            className="rounded-lg object-cover h-16"
                            src={
                                summary.thumbnail?.source ||
                                "/placeholder-user.jpg"
                            }
                            alt={summary.title}
                            width={64}
                            height={64}
                            style={{ maxHeight: "64px", maxWidth: "64px" }}
                        />
                    </div>
                    <div className="grow">
                        <h3 className="text-lg font-semibold mb-2">
                            {summary.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                            {summary.extract}
                        </p>
                        <Link
                            href={summary.content_urls.desktop.page}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center"
                        >
                            Read more on Wikipedia
                            <ExternalLinkIcon className="inline ml-1 w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default WikipediaSummaryCard;
