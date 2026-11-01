import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";

// Mark the route as dynamic
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const before = searchParams.get('before'); // timestamp for cursor-based pagination
        const limit = Math.min(
            parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT)),
            MAX_LIMIT
        );

        if (!userId) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: "User ID is required" 
                }, 
                { status: 400 }
            );
        }

        // Build query object
        const query: any = { userId };
        if (before) {
            query.updatedAt = { $lt: new Date(before) };
        }

        const chats = await Chat.find(
            query,
            {
                _id: 1,
                name: 1,
                updatedAt: 1,
                'messages': { $slice: -1 }
            }
        )
        .sort({ updatedAt: -1 })
        .limit(limit)
        .allowDiskUse(true)
        .lean<
            {
                _id: unknown;
                name: string;
                updatedAt: Date;
                messages?: { originalContent?: string }[];
            }[]
        >()
        .exec();

        // Get the total count for initial load only
        let total;
        if (!before) {
            total = await Chat.countDocuments({ userId });
        }

        return NextResponse.json({
            success: true,
            chats: chats.map(chat => ({
                _id: chat._id,
                name: chat.name,
                updatedAt: chat.updatedAt,
                lastMessage: chat.messages?.[0]?.originalContent || ''
            })),
            ...(total !== undefined && { total }),
            hasMore: chats.length === limit
        });
    } catch (error) {
        console.error("Error in GET /api/chats:", error);
        const errorMessage = error instanceof Error 
            ? error.message 
            : "An unknown error occurred";
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
