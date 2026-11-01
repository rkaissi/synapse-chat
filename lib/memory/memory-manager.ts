import { cosineSimilarity, generateText, Output } from "ai";
import { getModel } from "@/lib/utils/model-provider";
import { generateEmbedding, generateEmbeddings } from "@/lib/utils/embeddings";
import User from "@/models/user";
import { maxTokens, model, system, temperature } from "./config";
import { memorySchema } from "./schema";

export const extractMemory = async (message: string, userId: string) => {
    if (!message || !userId) {
        return;
    }

    // Fetch existing memories
    const user = await User.findById(userId);
    if (!user) {
        console.warn(`User not found for ID: ${userId}`);
        return;
    }

    const existingMemories = user.memories.map((memory: any) => ({
        id: memory._id,
        content: memory.content
    }));

    const { output } = await generateText({
        model: getModel(model),
        instructions: system,
        output: Output.object({ schema: memorySchema }),
        providerOptions: { openai: { strictJsonSchema: false } },
        prompt: `
Here is the message to analyze:
<message>
${message}
</message>

For context, here are the user's existing memories and their \`id\`s:
<existing_memories>
${JSON.stringify(existingMemories)}
</existing_memories>

Analyze the message and, if necessary, decide which memories to create, update, or delete based on the existing memories and the new information provided.
`,
        temperature,
        maxOutputTokens: maxTokens
    });

    const actions = output.actions;

    if (!actions || actions.length === 0) {
        return;
    }

    console.log(JSON.stringify(actions));

    for (const action of actions) {
        switch (action.type) {
            case "create":
                if (action.content) {
                    await createMemory(userId, action.content);
                    console.log("Memory created:", action.content);
                }
                break;
            case "update":
                if (action.content && action.targetID) {
                    await updateMemory(userId, action.targetID, action.content);
                    console.log("Memory updated:", action.content);
                }
                break;
            case "delete":
                if (action.targetID) {
                    await deleteMemory(userId, action.targetID);
                    console.log("Memory deleted");
                }
                break;
        }
    }

    return actions;
};

export const findRelevantMemories = async (
    userQuery: string,
    userId: string,
    limit: number = 3,
    similarityThreshold: number = 0.25 // A number between -1 and 1 representing the cosine similarity threshold between the two vectors.
) => {
    const userQueryEmbedding = await generateEmbedding(userQuery);

    let user = null;

    try {
        user = await User.findById(userId);
    } catch (error) {
        console.warn(`Error retrieving user: ${error}`);
    }

    if (!user) {
        console.warn(`User not found for ID: ${userId}`);
        return [];
    }

    if (!user.memories || user.memories.length === 0) {
        console.log(`No memories found for user: ${userId}`);
        return [];
    }

    const memories = user.memories.map((memory: any) => ({
        content: memory.content,
        embedding: memory.embedding,
        similarity: cosineSimilarity(userQueryEmbedding, memory.embedding)
    }));

    // Sort memories by similarity in descending order
    const sortedMemories = memories.sort(
        (a: any, b: any) => b.similarity - a.similarity
    );

    // Filter memories above the threshold
    const relevantMemories = sortedMemories
        .filter((memory: any) => memory.similarity > similarityThreshold)
        .slice(0, limit);

    // If there are relevant memories above the threshold, return them
    if (relevantMemories.length > 0) {
        return relevantMemories.map((memory: any) => memory.content);
    }

    // If there are no memories above the threshold, check if there's at least one memory with similarity > 0
    const mostRelevantMemory = sortedMemories.find(
        (memory: any) => memory.similarity > 0
    );

    // If there's a memory with similarity > 0, return it; otherwise, return an empty array
    return mostRelevantMemory ? [mostRelevantMemory.content] : [];
};

const createMemory = async (userId: string, content: string) => {
    if (!userId || !content) {
        throw new Error("User ID and memory content are required");
    }

    const embeddedMemory = await generateEmbeddings([content]);

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $push: { memories: embeddedMemory[0] } },
            { returnDocument: "after" }
        );

        if (!updatedUser) {
            throw new Error("User not found");
        }

        return embeddedMemory[0];
    } catch (error) {
        console.error(`Error creating memory: ${error}`);
        throw error;
    }
};

const updateMemory = async (
    userId: string,
    memoryId: string,
    newContent: string
) => {
    if (!userId || !memoryId || !newContent) {
        throw new Error("User ID, memory ID, and new content are required");
    }

    const newEmbedding = await generateEmbedding(newContent);

    try {
        const updatedUser = await User.findOneAndUpdate(
            { _id: userId, "memories._id": memoryId },
            {
                $set: {
                    "memories.$.content": newContent,
                    "memories.$.embedding": newEmbedding
                }
            },
            { returnDocument: "after" }
        );

        if (!updatedUser) {
            throw new Error("User or memory not found");
        }

        return { content: newContent, embedding: newEmbedding };
    } catch (error) {
        console.error(`Error updating memory: ${error}`);
        throw error;
    }
};

const deleteMemory = async (userId: string, memoryId: string) => {
    if (!userId || !memoryId) {
        throw new Error("User ID and memory ID are required");
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $pull: { memories: { _id: memoryId } } },
            { returnDocument: "after" }
        );

        if (!updatedUser) {
            throw new Error("User not found");
        }

        return true;
    } catch (error) {
        console.error(`Error deleting memory: ${error}`);
        throw error;
    }
};
