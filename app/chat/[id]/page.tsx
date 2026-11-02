import { Chat } from "@/components/chat";
import dbConnect from "@/lib/db";
import ChatModel from "@/models/chat";
import { getUserId } from "@/lib/user";
import { Metadata, ResolvingMetadata } from "next";

type Props = {
    params: Promise<{ id: string }>;
};

export async function generateMetadata(props: Props, parent: ResolvingMetadata): Promise<Metadata> {
    const params = await props.params;
    const chatId = params.id;

    try {
        await dbConnect();
        // Only the owner (or anyone, for public chats) sees the chat's name
        const userId = await getUserId();
        const chat = await ChatModel.findOne({
            _id: chatId,
            $or: [{ userId }, { public: true }]
        }).select("name");
        return { title: chat ? chat.name : "Chat" };
    } catch (error) {
        console.error("Failed to load chat metadata:", error);
        return { title: "Chat" };
    }
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    // Keyed so switching chats never reuses the previous chat's state
    return <Chat key={params.id} chatId={params.id} />;
}
