// Moves chats, published artifacts, memories and settings saved under the old
// fixed user "1" (before per-browser users) to a browser's ID, which is shown
// in Settings → Account. Nothing is deleted: the old user record stays as it
// was, but no browser can use the ID "1" anymore.
//
//   npm run claim-legacy-chats -- <browser-id> [--dry-run]
//
// Uses MONGODB_URI from the environment or .env.local.
import { existsSync, readFileSync } from "node:fs";
import mongoose from "mongoose";

const LEGACY_USER = "1";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const userId = args.find((arg) => !arg.startsWith("--"));

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId ?? "")) {
    console.error("Usage: npm run claim-legacy-chats -- <browser-id> [--dry-run]");
    console.error("Copy the browser ID from Settings → Account.");
    process.exit(1);
}

if (!process.env.MONGODB_URI && existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
        const match = line.match(/^MONGODB_URI=(.*)$/);
        if (match) process.env.MONGODB_URI = match[1];
    }
}
if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;
const chats = db.collection("chats");
const artifacts = db.collection("artifacts");
const users = db.collection("users");

const legacyUser = await users.findOne({ _id: LEGACY_USER });
const chatCount = await chats.countDocuments({ userId: LEGACY_USER });
const artifactCount = await artifacts.countDocuments({ userId: LEGACY_USER });
console.log(
    `Found ${chatCount} chats, ${artifactCount} published artifacts and ${legacyUser?.memories?.length ?? 0} memories under user "${LEGACY_USER}".`
);

if (dryRun) {
    console.log(`Dry run: nothing changed. Run without --dry-run to move them to ${userId}.`);
} else {
    await chats.updateMany({ userId: LEGACY_USER }, { $set: { userId } });
    await artifacts.updateMany({ userId: LEGACY_USER }, { $set: { userId } });

    if (legacyUser) {
        const existing = await users.findOne({ _id: userId });
        if (existing) {
            // The browser already saved something: keep its settings, add the
            // old memories and chat list
            await users.updateOne(
                { _id: userId },
                {
                    $push: { memories: { $each: legacyUser.memories ?? [] } },
                    $addToSet: { chats: { $each: legacyUser.chats ?? [] } }
                }
            );
        } else {
            const { _id: _legacyId, ...rest } = legacyUser;
            await users.insertOne({ ...rest, _id: userId });
        }
    }
    console.log(`Moved them to ${userId}. Reload the app in that browser.`);
}

await mongoose.disconnect();
