import { Button } from "@/components/ui";
import { NewMessage } from "@/lib/types";
import { FastForwardIcon } from "lucide-react";

interface Props {
    show: boolean;
    onHide: () => void;
    appendMessage: (message: NewMessage) => void;
}

const ContinueButton = ({ show, onHide, appendMessage }: Props) => {
    if (!show) return null;

    const handleContinueResponse = () => {
        // AI SDK 7 rejects system messages in the message history,
        // so the continuation request is sent as a user message
        appendMessage({
            role: "user",
            content: "Continue Response"
        });
        onHide();
    };

    return (
        <div className="fixed bottom-20 left-4 z-10">
            <Button
                onClick={handleContinueResponse}
                className="flex items-center space-x-2 shadow-lg"
            >
                <FastForwardIcon className="w-5 h-5" />
                <span>Continue Response</span>
            </Button>
        </div>
    );
};

export default ContinueButton;
