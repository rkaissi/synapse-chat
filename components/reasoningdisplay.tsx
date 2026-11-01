import React from "react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from "./ui/accordion";

interface ReasoningDisplayProps {
    reasoning: string;
}

export const ReasoningDisplay: React.FC<ReasoningDisplayProps> = ({
    reasoning
}) => {
    if (!reasoning || reasoning.trim() === "" || reasoning === "N/A") {
        return null;
    }

    return (
        <div className="mb-4">
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem
                    value="reasoning"
                    className="border border-gray-200/50 rounded-lg bg-gray-50/80"
                >
                    <AccordionTrigger className="px-4 py-3 text-sm font-medium text-gray-700 hover:no-underline hover:bg-gray-100/80 rounded-t-lg data-[state=open]:rounded-b-none">
                        Reasoning
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 bg-white rounded-b-lg">
                        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {reasoning}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
};
