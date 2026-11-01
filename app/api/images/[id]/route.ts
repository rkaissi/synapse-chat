import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import GeneratedImage from "@/models/image";

export async function GET(
    _request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const { id } = await props.params;
    try {
        await dbConnect();
        const image = await GeneratedImage.findById(id)
            .select("data mediaType")
            .lean<{ data: { buffer: Uint8Array }; mediaType: string }>();
        if (!image) {
            return NextResponse.json({ error: "Image not found" }, { status: 404 });
        }

        // Lean documents return BSON Binary; its .buffer holds the bytes
        return new NextResponse(new Uint8Array(image.data.buffer), {
            headers: {
                "Content-Type": image.mediaType,
                // Images never change once generated
                "Cache-Control": "public, max-age=31536000, immutable"
            }
        });
    } catch (error) {
        console.error("Error in GET /api/images/[id]:", error);
        return NextResponse.json({ error: "Failed to load image" }, { status: 500 });
    }
}
