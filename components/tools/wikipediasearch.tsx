import { Card, CardContent } from "@/components/ui/card";
import { WikipediaSearchResult } from "@/lib/types";
import { ChevronDownIcon, ChevronUpIcon, ExternalLinkIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui";

interface WikipediaSearchCardProps {
    results: WikipediaSearchResult[];
}

const WikipediaSearchCard: React.FC<WikipediaSearchCardProps> = ({
    results
}) => {
    const [showAll, setShowAll] = useState(false);
    const visibleResults = showAll ? results : results.slice(0, 2);

    return (
        <Card className="w-full">
            <CardContent className="p-4">
                <h3 className="text-lg font-semibold mb-3">
                    Wikipedia Search Results
                </h3>
                {visibleResults.map((result, index) => (
                    <div
                        key={result.id}
                        className={`flex items-start space-x-4 ${
                            index > 0 ? "mt-4" : ""
                        }`}
                    >
                        <div className="relative h-16 w-16 shrink-0 mt-1">
                            <Image
                                className="rounded-lg object-cover h-16"
                                src={
                                    result.thumbnail?.url ||
                                    "/placeholder-user.jpg"
                                }
                                alt={result.title}
                                width={64}
                                height={64}
                                style={{ maxHeight: "64px", maxWidth: "64px" }}
                                unoptimized
                            />
                        </div>
                        <div className="grow">
                            <h4 className="text-md font-semibold">
                                {result.title}
                            </h4>
                            {result.description && (
                                <p className="text-sm text-gray-500 mb-1">
                                    {result.description}
                                </p>
                            )}
                            <p
                                className="text-sm text-gray-600 mb-2"
                                dangerouslySetInnerHTML={{
                                    __html: result.excerpt
                                }}
                            />
                            <Link
                                href={`https://en.wikipedia.org/wiki/${result.key}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline flex items-center"
                            >
                                Read more
                                <ExternalLinkIcon className="inline ml-1 w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                ))}
                {results.length > 2 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAll(!showAll)}
                        className="mt-4 w-full"
                    >
                        {showAll ? (
                            <>
                                <ChevronUpIcon className="w-4 h-4 mr-2" />
                                Show less
                            </>
                        ) : (
                            <>
                                <ChevronDownIcon className="w-4 h-4 mr-2" />
                                View {results.length - 2} more results
                            </>
                        )}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
};

export default WikipediaSearchCard;
