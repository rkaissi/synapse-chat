import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import { getUserId } from "@/lib/user";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        await dbConnect();

        const chatId = params.id;
        const chat = await Chat.findById(chatId);
        const userId = await getUserId();

        // Other browsers' chats look like missing ones (unless made public)
        if (!chat || (chat.userId !== userId && !chat.public)) {
            return NextResponse.json(
                { success: false, error: "Chat not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            messages: chat.messages,
            repo: chat.repo ?? null
        });
    } catch (error) {
        console.error("Error in GET /api/chat/[id]:", error);
        const errorMessage =
            error instanceof Error
                ? error.message
                : "An unknown error occurred";
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
