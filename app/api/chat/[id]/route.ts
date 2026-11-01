import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        await dbConnect();

        const chatId = params.id;
        const chat = await Chat.findById(chatId);

        if (!chat) {
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
