import { NewMessage } from "@/lib/types";
import { useState } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import {
    ChevronDownIcon,
    ChevronUpIcon,
    ExternalLinkIcon,
    SearchIcon
} from "lucide-react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";

interface RelatedSearchesProps {
    searches: Array<{ displayText: string; webSearchUrl: string }>;
    addMessage: (message: NewMessage) => void;
}

const RelatedSearches: React.FC<RelatedSearchesProps> = ({
    searches,
    addMessage
}) => {
    const [showAll, setShowAll] = useState(false);
    const visibleSearches = showAll ? searches : searches.slice(0, 2);

    return (
        <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Related Searches</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {visibleSearches.map((search, index) => (
                    <TooltipProvider key={index}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card
                                    className="hover:shadow-md transition-shadow duration-200 cursor-pointer group"
                                    onClick={() =>
                                        addMessage({
                                            role: "user",
                                            content: search.displayText
                                        })
                                    }
                                >
                                    <div className="p-3 flex items-center justify-between">
                                        <div className="flex items-center grow overflow-hidden">
                                            <SearchIcon className="w-4 h-4 mr-2 shrink-0 text-gray-500 group-hover:text-gray-700" />
                                            <span className="text-sm truncate">
                                                {search.displayText}
                                            </span>
                                        </div>
                                        <Link
                                            href={search.webSearchUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-2 p-1 text-gray-500 hover:text-gray-700"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ExternalLinkIcon className="w-4 h-4" />
                                        </Link>
                                    </div>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="w-80 p-0">
                                <div className="p-4">
                                    <p className="font-semibold mb-2">
                                        {search.displayText}
                                    </p>
                                    <Link
                                        href={search.webSearchUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:underline flex items-center"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Open in Bing
                                        <ExternalLinkIcon className="inline ml-1 w-4 h-4" />
                                    </Link>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ))}
            </div>
            {searches.length > 2 && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAll(!showAll)}
                    className="mt-4"
                >
                    {showAll ? (
                        <>
                            <ChevronUpIcon className="w-4 h-4 mr-2" />
                            Show less
                        </>
                    ) : (
                        <>
                            <ChevronDownIcon className="w-4 h-4 mr-2" />
                            View {searches.length - 2} more
                        </>
                    )}
                </Button>
            )}
        </div>
    );
};

export default RelatedSearches;
