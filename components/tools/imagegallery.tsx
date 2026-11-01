import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

const ImageGallery = ({ images }: { images: any[] }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    const scroll = (direction: "left" | "right") => {
        const container = scrollContainerRef.current;
        if (container) {
            const scrollAmount = container.clientWidth;
            const scrollLeft =
                direction === "left" ? -scrollAmount : scrollAmount;
            container.scrollBy({ left: scrollLeft, behavior: "smooth" });
        }
    };

    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (container) {
            setShowLeftArrow(container.scrollLeft > 0);
            setShowRightArrow(
                container.scrollLeft <
                    container.scrollWidth - container.clientWidth * 1.1
            );
        }
    };

    return (
        <div>
            <h3 className="text-lg font-semibold mb-2">Images</h3>
            <div className="relative">
                <div
                    ref={scrollContainerRef}
                    className="flex overflow-x-auto space-x-4 py-2 scrollbar-hide"
                    onScroll={handleScroll}
                >
                    {images.map((image, index) => (
                        <TooltipProvider key={index}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="shrink-0 max-h-32">
                                        <Link
                                            key={index}
                                            href={image.hostPageUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Image
                                                src={image.thumbnailUrl}
                                                alt={image.name}
                                                width={200}
                                                height={128}
                                                objectFit="contain"
                                                style={{ maxHeight: "128px" }}
                                                className="rounded-lg object-cover cursor-pointer max-h-32"
                                            />
                                        </Link>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent
                                    side="bottom"
                                    className="w-64 p-2"
                                >
                                    <p className="font-semibold">
                                        {image.name}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {image.hostPageDisplayUrl}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ))}
                </div>
                {showLeftArrow && (
                    <Button
                        variant="outline"
                        size="icon"
                        className="absolute left-0 top-1/2 transform -translate-y-1/2"
                        onClick={() => scroll("left")}
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                    </Button>
                )}
                {showRightArrow && (
                    <Button
                        variant="outline"
                        size="icon"
                        className="absolute right-0 top-1/2 transform -translate-y-1/2"
                        onClick={() => scroll("right")}
                    >
                        <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
};

export default ImageGallery;
