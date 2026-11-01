import mongoose, { Schema } from "mongoose";

// Images created by the generate_image tool. Image models return raw image
// data, so it is stored here and served from /api/images/[id].
const imageSchema: Schema = new Schema(
    {
        _id: { type: String, required: true },
        data: { type: Buffer, required: true },
        mediaType: { type: String, required: true },
        prompt: { type: String },
        model: { type: String }
    },
    { timestamps: true }
);

const GeneratedImage =
    mongoose.models.GeneratedImage ||
    mongoose.model("GeneratedImage", imageSchema);
export default GeneratedImage;
