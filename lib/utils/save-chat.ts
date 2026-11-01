import { CombinedMessage, RepoConnection, Settings } from "@/lib/types";
import toast from "react-hot-toast";

const saveChat = async (
    userId: string,
    chatId: string,
    chatName: string,
    messages: CombinedMessage[],
    settings: Settings,
    repo: RepoConnection | null = null,
    setIsSaving?: (value: boolean) => void
) => {
    if (setIsSaving) {
        setIsSaving(true);
    }

    try {
        const response = await fetch("/api/save", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                userId,
                chatId,
                chatName,
                messages,
                settings,
                repo
            })
        });

        if (!response.ok) {
            throw new Error("Failed to save chat");
        }

        const data = await response.json();

        if (data.chatId) {
            return data.chatId;
        }
    } catch (error) {
        toast.error("Error saving chat");
        console.log("Error saving chat:", error);
    } finally {
        if (setIsSaving) {
            setIsSaving(false);
        }
    }
};

export default saveChat;
