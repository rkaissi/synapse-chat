"use client";

import { Chat } from "@/components/chat";
import { generateId } from "ai";
import { useEffect, useState } from "react";
import { NEW_CHAT_EVENT } from "@/lib/utils/new-chat";

export default function Page() {
    const userId = "1";
    // Stable for the lifetime of the page (a new id per render would split the chat)
    const [chatId, setChatId] = useState(() => generateId());

    // After the first message the URL is rewritten to /chat/[id] without a
    // navigation, so this page stays mounted. "New chat" resets it explicitly.
    useEffect(() => {
        const startNewChat = () => setChatId(generateId());
        window.addEventListener(NEW_CHAT_EVENT, startNewChat);
        return () => window.removeEventListener(NEW_CHAT_EVENT, startNewChat);
    }, []);

    return <Chat key={chatId} userId={userId} chatId={chatId} />;
}
