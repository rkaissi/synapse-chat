import { AlertCircle, RefreshCw } from "lucide-react";
import { Button, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";

interface ChatErrorMessageProps {
    message: string;
    onRetry?: () => void;
}

export const ChatErrorMessage = ({
    message,
    onRetry
}: ChatErrorMessageProps) => {
    return (
        <div className="flex items-start gap-4">
            <Avatar className="w-9 h-9 border shrink-0">
                <AvatarImage src="/placeholder-user.jpg" />
                <AvatarFallback>OA</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden mb-2">
                <div className="flex items-center justify-between align-middle pt-1 pr-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">Assistant</span>
                    </div>
                </div>
                <div className="mt-2 p-3 rounded-md border border-red-200 bg-red-50">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <div className="text-md font-medium mb-1 text-red-700">
                                An error occurred
                            </div>
                            <p className="text-sm text-red-600">{message}</p>
                            {onRetry && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onRetry}
                                    className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-100"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Retry
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
