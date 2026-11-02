import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Artifact from "@/models/artifact";
import { getUserId } from "@/lib/user";

export async function POST(req: NextRequest) {
    try {
        await dbConnect();

        const artifactData = await req.json();
        const artifact = new Artifact({
            ...artifactData,
            userId: (await getUserId()) ?? "anonymous"
        });
        // The address this request came to, so links work on localhost,
        // preview deployments, production and custom domains alike
        const shareableURL = `${req.nextUrl.origin}/artifacts/${artifact._id}`;
        artifact.shareableURL = shareableURL;
        await artifact.save();

        return NextResponse.json({ id: artifact._id }, { status: 201 });
    } catch (error) {
        console.error("Error saving artifact:", error);
        return NextResponse.json(
            { error: "Failed to save artifact" },
            { status: 500 }
        );
    }
}
