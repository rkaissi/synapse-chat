import mongoose from "mongoose";

const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/ChatbotDB";

declare global {
    var mongoose: any;
}

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const dbConnect = async () => {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        cached.promise = mongoose
            .connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
            .then((mongoose) => {
                console.log("Connected to MongoDB");
                return mongoose;
            });
    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        // Don't cache the failure: the next request retries the connection
        cached.promise = null;
        console.error(
            "Could not connect to MongoDB:",
            error instanceof Error ? error.message : error
        );
        throw error;
    }
    return cached.conn;
};

export default dbConnect;
