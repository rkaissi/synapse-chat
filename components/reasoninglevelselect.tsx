import React from "react";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { REASONING_LEVELS, ReasoningLevel } from "@/lib/types";

export const REASONING_LEVEL_LABELS: Record<ReasoningLevel, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "Extra high"
};

interface Props {
    value: ReasoningLevel;
    onChange: (value: ReasoningLevel) => void;
    disabled?: boolean;
    // Compact trigger for the chat composer
    compact?: boolean;
    className?: string;
}

const ReasoningLevelSelect = ({ value, onChange, disabled, compact, className }: Props) => (
    <Select value={value} onValueChange={(next) => onChange(next as ReasoningLevel)} disabled={disabled}>
        <SelectTrigger
            className={cn(
                compact &&
                    "h-8 w-auto gap-1.5 rounded-full border-none bg-transparent px-2.5 text-xs text-muted-foreground shadow-none hover:bg-muted hover:text-foreground focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring/30",
                className
            )}
            aria-label="Reasoning level"
            title={compact ? "Reasoning level" : undefined}
        >
            <SelectValue />
        </SelectTrigger>
        <SelectContent>
            <SelectGroup>
                <SelectLabel className="text-xs font-normal text-muted-foreground">
                    Reasoning
                </SelectLabel>
                {REASONING_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                        {REASONING_LEVEL_LABELS[level]}
                    </SelectItem>
                ))}
            </SelectGroup>
        </SelectContent>
    </Select>
);

export default ReasoningLevelSelect;
