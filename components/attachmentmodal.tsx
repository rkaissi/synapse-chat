import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription
} from "@/components/ui";
import { FileIcon } from "@radix-ui/react-icons";
import Image from "next/image";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    file: File | null;
    fallback?: string;
    image?: boolean;
}

const AttachmentModal = ({ isOpen, onClose, file, fallback, image }: Props) => {
    const [fileText, setFileText] = useState<string | null>(null);

    useEffect(() => {
        const readFileText = async () => {
            if (file && !file.type.startsWith("image/")) {
                const text = await file.text();
                setFileText(text);
            } else {
                setFileText(null);
            }
        };

        readFileText();
    }, [file]);

    if (!file && !fallback) return null;

    const isImage = (file && file.type.startsWith("image/")) || image;

    const src = fallback || (file && URL.createObjectURL(file));

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <DialogTitle className="text-lg font-semibold">
                    Attachment Preview
                </DialogTitle>
                <DialogDescription className="flex items-center">
                    <FileIcon className="w-6 h-6 text-gray-500 mr-2" />
                    <span className="text-sm font-medium truncate">
                        {file?.name || (isImage ? src : "File")}
                    </span>
                </DialogDescription>
                <div className="grow overflow-auto">
                    {isImage ? (
                        <Image
                            src={src || ""}
                            alt={file?.name || "Image"}
                            width={0}
                            height={0}
                            sizes="100vw"
                            objectFit="contain"
                            className="max-w-full max-h-[calc(90vh-10rem)] object-contain mx-auto"
                            style={{ width: "auto", height: "auto" }}
                        />
                    ) : (
                        <div className="flex flex-col h-full w-full">
                            <pre className="bg-gray-100 p-4 rounded w-full h-full overflow-auto text-sm">
                                {fileText || fallback}
                            </pre>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default AttachmentModal;
