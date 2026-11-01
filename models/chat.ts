import mongoose, { Schema } from "mongoose";
import { artifactSchema } from "./artifact";

const stateSchema: Schema = new Schema({
    content: { type: String },
    artifact: { type: artifactSchema },
    timestamp: { type: Number, required: true }
});

const messageSchema: Schema = new Schema({
    id: { type: String, required: true },
    role: { type: String, required: true },
    originalContent: { type: String },
    processedContent: { type: String },
    attachments: { type: Schema.Types.Mixed },
    artifact: { type: artifactSchema },
    model: { type: String },
    toolInvocations: { type: [Schema.Types.Mixed] },
    completionTokens: { type: Number },
    promptTokens: { type: Number },
    totalTokens: { type: Number },
    cacheWriteTokens: { type: Number },
    cacheReadTokens: { type: Number },
    finishReason: { type: String },
    reasoning: { type: String },
    states: { type: [stateSchema] }
});

const chatSchema: Schema = new Schema(
    {
        _id: { type: String, required: true },
        userId: { type: String, required: true, ref: "User" },
        name: { type: String, default: "New Chat", required: true },
        messages: { type: [messageSchema], required: true },
        public: { type: Boolean, default: false, required: true }
    },
    { timestamps: true }
);

// Serves the chat history query in /api/chats
chatSchema.index({ userId: 1, updatedAt: -1 });

const Chat = mongoose.models.Chat || mongoose.model("Chat", chatSchema);
export default Chat;
