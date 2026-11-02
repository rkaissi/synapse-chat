import { NextResponse } from "next/server";
import { getUserId } from "@/lib/user";

// The browser's anonymous user ID (the cookie is httpOnly, so the page can't
// read it directly). Shown in Settings → Account.
export async function GET() {
    const userId = await getUserId();
    if (!userId) {
        return NextResponse.json({ error: "Missing user cookie" }, { status: 401 });
    }
    return NextResponse.json({ userId });
}
