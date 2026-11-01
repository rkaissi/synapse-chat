import React, { useRef } from "react";
import { memo, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { usePathname, redirect } from "next/navigation";
import { cn } from "@/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SidebarSkeleton } from "./sidebarskeleton";

interface Chat {
    _id: string;
    name: string;
    updatedAt: string;
    lastMessage: string;
}

interface Props {
    userId: string;
}

const CHAT_ITEM_HEIGHT = 76;
const INITIAL_LOAD_COUNT = 20;
const SCROLL_THRESHOLD = 100;

export const Sidebar = memo(function Sidebar({ userId }: Props) {
    const pathname = usePathname();
    const [chats, setChats] = useState<Chat[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [total, setTotal] = useState<number | null>(null);

    const parentRef = React.useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const virtualizer = useVirtualizer({
        count: chats.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => CHAT_ITEM_HEIGHT,
        overscan: 5
    });

    const fetchChats = useCallback(
        async (beforeTimestamp?: string) => {
            // Abort previous request if it exists
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new abort controller
            abortControllerRef.current = new AbortController();

            try {
                const queryParams = new URLSearchParams({
                    userId,
                    limit: INITIAL_LOAD_COUNT.toString(),
                    ...(beforeTimestamp && { before: beforeTimestamp })
                });

                const response = await fetch(`/api/chats?${queryParams}`, {
                    signal: abortControllerRef.current.signal
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch chats");
                }

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || "Failed to fetch chats");
                }

                // Set total only on initial load
                if (!beforeTimestamp && data.total !== undefined) {
                    setTotal(data.total);
                }

                return {
                    chats: data.chats,
                    hasMore: data.hasMore
                };
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError") {
                    // Ignore abort errors
                    return null;
                }
                throw error;
            }
        },
        [userId]
    );

    // Initial load
    useEffect(() => {
        const loadInitialChats = async () => {
            try {
                setIsInitialLoading(true);
                setError(null);
                const result = await fetchChats();
                if (result) {
                    setChats(result.chats);
                    setHasMore(result.hasMore);
                }
            } catch (error) {
                console.error("Failed to fetch chats:", error);
                setError(
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch chats"
                );
            } finally {
                setIsInitialLoading(false);
            }
        };

        loadInitialChats();

        // Cleanup function
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchChats]);

    // Handle scroll and load more
    const handleScroll = useCallback(
        async (e: React.UIEvent<HTMLDivElement>) => {
            if (!hasMore || isLoadingMore || chats.length === 0) return;

            const element = e.target as HTMLDivElement;
            const scrollBottom =
                element.scrollHeight - element.scrollTop - element.clientHeight;

            if (scrollBottom < SCROLL_THRESHOLD) {
                try {
                    setIsLoadingMore(true);
                    const lastChat = chats[chats.length - 1];
                    const result = await fetchChats(lastChat.updatedAt);

                    if (result) {
                        setChats((prevChats) => [
                            ...prevChats,
                            ...result.chats
                        ]);
                        setHasMore(result.hasMore);
                    }
                } catch (error) {
                    console.error("Failed to load more chats:", error);
                } finally {
                    setIsLoadingMore(false);
                }
            }
        },
        [hasMore, isLoadingMore, chats, fetchChats]
    );

    const truncateText = useCallback((text: string, maxLength: number = 28) => {
        return text.length > maxLength
            ? text.substring(0, maxLength) + "..."
            : text;
    }, []);

    const formatDate = useCallback((dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInDays = Math.floor(
            (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffInDays === 0) {
            return date.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true
            });
        } else if (diffInDays === 1) {
            return "Yesterday";
        } else if (diffInDays < 7) {
            return date.toLocaleDateString("en-US", { weekday: "short" });
        } else {
            return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric"
            });
        }
    }, []);

    return (
        <div className="flex flex-col h-full bg-background">
            <div
                ref={parentRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto py-2 px-2"
            >
                {isInitialLoading ? (
                    <SidebarSkeleton />
                ) : error ? (
                    <div className="text-sm text-destructive p-4 text-center">
                        {error}
                    </div>
                ) : chats.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 text-center">
                        No chat history yet
                    </div>
                ) : (
                    <div
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: "100%",
                            position: "relative"
                        }}
                    >
                        {virtualizer.getVirtualItems().map((virtualRow) => {
                            const chat = chats[virtualRow.index];
                            return (
                                <Button
                                    key={chat._id}
                                    variant="ghost"
                                    className={cn(
                                        "absolute top-0 left-0 w-full justify-start px-3 py-4 h-auto",
                                        "hover:bg-accent hover:text-accent-foreground",
                                        "transition-colors duration-200",
                                        pathname?.includes(chat._id) &&
                                            "bg-accent text-accent-foreground"
                                    )}
                                    style={{
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`
                                    }}
                                    onClick={() =>
                                        redirect(`/chat/${chat._id}`)
                                    }
                                >
                                    <div className="flex items-start w-full">
                                        <MessageSquare className="mr-2 h-5 w-5 shrink-0 mt-0.5" />
                                        <div className="flex flex-col items-start overflow-hidden w-full">
                                            <div className="flex justify-between w-full">
                                                <span className="text-sm font-medium truncate flex-1">
                                                    {truncateText(chat.name)}
                                                </span>
                                                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                                                    {formatDate(chat.updatedAt)}
                                                </span>
                                            </div>
                                            {chat.lastMessage && (
                                                <span className="text-xs text-muted-foreground truncate w-full">
                                                    {truncateText(
                                                        chat.lastMessage,
                                                        40
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Button>
                            );
                        })}
                    </div>
                )}
                {isLoadingMore && (
                    <div className="py-2">
                        <div className="h-[72px] bg-muted animate-pulse rounded-lg" />
                    </div>
                )}
            </div>
        </div>
    );
});
