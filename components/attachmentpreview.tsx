import { useState } from "react";
import AttachmentModal from "./attachmentmodal";
import { FileIcon } from "lucide-react";
import Image from "next/image";

interface AttachmentPreviewProps {
    attachments?: { contentType: string; name: string; url: string }[];
}

const AttachmentPreview = ({ attachments }: AttachmentPreviewProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedFileFallback, setSelectedFileFallback] = useState("");

    const handleAttachmentClick = (attachment: {
        contentType: string;
        name: string;
        url: string;
    }) => {
        setSelectedFile(
            new File([], attachment.name, {
                type: attachment.contentType
            })
        );
        setSelectedFileFallback(
            attachment.contentType.includes("image/")
                ? attachment.url
                : atob(attachment.url.split(",")[1])
        );
        setIsModalOpen(true);
    };

    return (
        <>
            <AttachmentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                file={selectedFile}
                fallback={selectedFileFallback}
            />
            <div className="mt-2 space-y-2">
                {attachments?.map((attachment, index) => (
                    <div
                        key={index}
                        className="flex items-center max-w-80 p-2 pr-4 bg-white border border-input rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleAttachmentClick(attachment)}
                    >
                        <div className="shrink-0 w-10 h-10 mr-3">
                            {attachment.contentType.startsWith("image/") ? (
                                <div className="relative w-full h-full rounded-md overflow-hidden">
                                    <Image
                                        src={attachment.url}
                                        alt={attachment.name}
                                        layout="fill"
                                        objectFit="cover"
                                    />
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-md">
                                    <FileIcon className="h-5 w-5 text-gray-500" />
                                </div>
                            )}
                        </div>
                        <div className="grow min-w-0 overflow-hidden">
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {attachment.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                                {attachment.contentType}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

export default AttachmentPreview;
