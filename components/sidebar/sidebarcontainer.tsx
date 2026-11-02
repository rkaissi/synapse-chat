import React from "react";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";

interface Props {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export const SidebarContainer = ({ isOpen, onOpenChange }: Props) => {
    const isDesktop = useMediaQuery("(min-width: 1024px)");

    if (isDesktop) {
        return (
            <div
                className={cn(
                    "h-full bg-background border-r",
                    "transition-all duration-300 ease-in-out",
                    isOpen ? "w-80" : "w-0"
                )}
            >
                {isOpen && <Sidebar />}
            </div>
        );
    }

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="left" className="w-80 p-0">
                <Sidebar />
            </SheetContent>
        </Sheet>
    );
};
