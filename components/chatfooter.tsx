import React, { useRef, useState, useEffect, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { FileIcon } from "@radix-ui/react-icons";
import { XIcon, ArrowUpIcon } from "./icons";
import toast from "react-hot-toast";
import AttachmentModal from "./attachmentmodal";
import { PaperclipIcon } from "lucide-react";
import { StopIcon } from "@heroicons/react/24/solid";
import Image from "next/image";
import { supportedFileFormats, usableFileFormats } from "@/app/api/chat/config";
import { extractRawText } from "mammoth";

interface Props {
    input: string;
    handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleSubmit: (
        event: React.FormEvent<HTMLFormElement>,
        files?: FileList
    ) => void;
    isLoading: boolean;
    handleStop: () => void;
    enablePasteToFile: boolean;
    disabled?: boolean;
    // Extra controls shown inside the input, left of the send button
    controls?: React.ReactNode;
}

const LARGE_TEXT_THRESHOLD = 2000;

const timestampedFileName = (prefix: string, extension?: string) =>
    `${prefix}-${Date.now()}${extension ? `.${extension}` : ""}`;

const ChatFooter = ({
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    handleStop,
    enablePasteToFile,
    disabled = false,
    controls
}: Props) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isMultiline, setIsMultiline] = useState(false);
    const [files, setFiles] = useState<FileList | undefined>(undefined);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            const form = event.currentTarget.form;
            if (form) {
                form.dispatchEvent(
                    new Event("submit", { cancelable: true, bubbles: true })
                );
            }
        } else if (event.key === "Enter" && event.shiftKey) {
            // Delay the scroll to after the new line is added
            setTimeout(() => scrollToBottom(), 10);
        }
    };

    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
        const isCharacterKey =
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey;

        // Check if the active element is any input-like element
        const isInputElement =
            document.activeElement instanceof HTMLInputElement ||
            document.activeElement instanceof HTMLTextAreaElement;

        if (
            isCharacterKey &&
            !isInputElement &&
            document.activeElement !== textareaRef.current
        ) {
            textareaRef.current?.focus();
        }
    };

    useEffect(() => {
        // Focus the textarea by default when the component mounts
        textareaRef.current?.focus();

        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => {
            window.removeEventListener("keydown", handleGlobalKeyDown);
        };
    }, []);

    const handleTextareaChange = (
        event: React.ChangeEvent<HTMLTextAreaElement>
    ) => {
        handleInputChange(event);
        adjustTextareaHeight();
        scrollToBottom();
    };

    const adjustTextareaHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            const newHeight = Math.min(
                textareaRef.current.scrollHeight,
                5 * 24 + 16
            );
            textareaRef.current.style.height = `${newHeight}px`;

            // Check if the content height is greater than the line height
            const lineHeight = 50; // Adjust this value based on your actual line height
            const isMulti = textareaRef.current.scrollHeight > lineHeight;

            setIsMultiline(
                isMulti || textareaRef.current.value.split("\n").length > 1
            );
        }
    };

    const scrollToBottom = () => {
        if (textareaRef.current) {
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
    };

    // Only the input affects the height (handleInputChange is a new function
    // on every parent render, which re-ran this on every streamed chunk)
    useEffect(() => {
        adjustTextareaHeight();
    }, [input]);

    const handleFileUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        if (event.target.files) {
            const newFiles = Array.from(event.target.files);
            const processedFiles: File[] = [];

            for (const file of newFiles) {
                const fileExtension = `.${file.name
                    .split(".")
                    .pop()
                    ?.toLowerCase()}`;
                if (supportedFileFormats.includes(fileExtension)) {
                    processedFiles.push(file);
                } else {
                    try {
                        const convertedFile = await convertToTextFile(file);
                        processedFiles.push(convertedFile);
                        toast.success(
                            `Unsupported file type: Converted ${file.name} to text file`
                        );
                    } catch (error) {
                        toast.error(
                            `Unsupported file type - failed to convert file: ${file.name}`
                        );
                        console.error(error);
                    }
                }
            }

            if (processedFiles.length > 0) {
                const dataTransfer = new DataTransfer();
                processedFiles.forEach((file) => dataTransfer.items.add(file));
                setFiles(dataTransfer.files);
            } else {
                setFiles(undefined);
            }
        }
    };

    const removeFile = (fileToRemove: File) => {
        if (files) {
            const dataTransfer = new DataTransfer();
            Array.from(files).forEach((file) => {
                if (file !== fileToRemove) {
                    dataTransfer.items.add(file);
                }
            });
            setFiles(
                dataTransfer.files.length > 0 ? dataTransfer.files : undefined
            );
        }
    };

    const renderFilePreview = (file: File) => {
        const isImage = file.type.startsWith("image/");
        const imageSrc = isImage ? URL.createObjectURL(file) : "";
        return (
            <div
                key={file.name}
                className="flex items-center rounded-lg p-2 mb-2 cursor-pointer border border-input"
                onClick={() => {
                    setIsModalOpen(true);
                    setSelectedFile(file);
                }}
            >
                {isImage ? (
                    <Image
                        src={imageSrc}
                        alt={file.name}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-md object-cover mr-2"
                    />
                ) : (
                    <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-md mr-2">
                        <FileIcon className="h-5 w-5 text-gray-600" />
                    </div>
                )}
                <span className="text-sm truncate grow">{file.name}</span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file);
                    }}
                    className="ml-2 rounded-full"
                >
                    <XIcon className="w-4 h-4" />
                </Button>
            </div>
        );
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (event.dataTransfer.files) {
            handleFileUpload({
                target: { files: event.dataTransfer.files }
            } as React.ChangeEvent<HTMLInputElement>);
        }
    };

    const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        try {
            const items = event.clipboardData.items;
            const imageItems = Array.from(items).filter(
                (item) => item.type.indexOf("image") !== -1
            );
            const textItems = Array.from(items).filter(
                (item) => item.type === "text/plain"
            );

            if (imageItems.length > 0) {
                event.preventDefault();
                for (const item of imageItems) {
                    const blob = item.getAsFile();
                    if (blob) {
                        const fileExtension = blob.type.split("/")[1] || "png";
                        const file = new File(
                            [blob],
                            timestampedFileName("image", fileExtension),
                            { type: blob.type }
                        );
                        addFile(file);
                    }
                }
            }

            if (enablePasteToFile && textItems.length > 0) {
                const text = event.clipboardData.getData("text/plain");

                if (text.length > LARGE_TEXT_THRESHOLD) {
                    event.preventDefault();
                    const file = new File([text], timestampedFileName("pasted-text"), {
                        type: "text/plain"
                    });
                    addFile(file);
                    toast.success("Pasted text converted to file");
                }
                // If text is shorter, do nothing and allow default paste behavior
            }
        } catch (error) {
            console.error("Error handling paste:", error);
            toast.error(
                "An error occurred while processing the pasted content"
            );
        }
    };

    const addFile = (file: File) => {
        setFiles((prevFiles) => {
            const dataTransfer = new DataTransfer();
            if (prevFiles) {
                Array.from(prevFiles).forEach((f) => dataTransfer.items.add(f));
            }
            dataTransfer.items.add(file);
            return dataTransfer.files;
        });
    };

    return (
        <>
            <AttachmentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                file={selectedFile}
            />
            <div className="flex grow-0 w-full bg-background py-2 px-4 border-t align-middle items-center justify-center">
                <form
                    className="relative max-w-[650px] w-full"
                    onSubmit={(event) => {
                        if (disabled) {
                            event.preventDefault();
                            return;
                        }
                        handleSubmit(event, files);
                        setFiles(undefined);
                        if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                        }
                    }}
                >
                    {files && files.length > 0 && (
                        <div className="max-h-32 overflow-y-auto px-4">
                            {Array.from(files).map(renderFilePreview)}
                        </div>
                    )}
                    <Button
                        size="icon"
                        className="absolute w-8 h-8 bottom-2 left-3 rounded-full z-10 bg-black cursor-pointer flex items-center justify-center"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <PaperclipIcon className="w-4 h-4 text-primary-foreground" />
                        <span className="sr-only">Attach File</span>
                    </Button>
                    <input
                        id="file-upload"
                        type="file"
                        ref={fileInputRef}
                        multiple
                        accept={usableFileFormats.join(", ")}
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <div
                        className={`${
                            isMultiline ? "rounded-2xl" : "rounded-full"
                        } border border-neutral-400 shadow-xs bg-grey-100 w-full flex items-center min-h-[48px] max-h-[136px] overflow-hidden z-10`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <div className="shrink-0 w-12 h-full" />
                        <textarea
                            ref={textareaRef}
                            placeholder="Message Assistant"
                            name="message"
                            id="message"
                            className="resize-none py-3 px-1 m-0 w-full focus:outline-hidden bg-transparent border-none z-10"
                            value={input}
                            onChange={handleTextareaChange}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            rows={1}
                        />
                        <div className={`shrink-0 h-full ${controls ? "w-40" : "w-12"}`} />
                    </div>
                    {controls && (
                        <div className="absolute bottom-2 right-12 z-10">
                            {controls}
                        </div>
                    )}
                    <Button
                        type={isLoading ? "button" : "submit"}
                        size="icon"
                        disabled={
                            disabled ||
                            (!isLoading &&
                                input.length === 0 &&
                                (!files || files.length === 0))
                        }
                        className="absolute w-8 h-8 bottom-2 right-3 rounded-full items-center justify-center z-10"
                        onClick={handleStop}
                    >
                        {isLoading ? (
                            <StopIcon className="w-4 h-4 text-primary-foreground" />
                        ) : (
                            <ArrowUpIcon className="w-4 h-4 text-primary-foreground" />
                        )}
                        <span className="sr-only">
                            {isLoading ? "Stop" : "Send"}
                        </span>
                    </Button>
                </form>
            </div>
        </>
    );
};

export default ChatFooter;

const convertToTextFile = async (file: File): Promise<File> => {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    let content = "";

    try {
        if (fileExtension === "doc" || fileExtension === "docx") {
            content = await convertDocToText(file);
        } else {
            // For other file types, use the previous method
            content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) =>
                    resolve(event.target?.result as string);
                reader.onerror = (error) => reject(error);
                reader.readAsText(file);
            });
        }

        const blob = new Blob([content], { type: "text/plain" });
        return new File([blob], file.name, { type: "text/plain" });
    } catch (error) {
        console.error("Error converting file:", error);
        throw error;
    }
};

const convertDocToText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await extractRawText({ arrayBuffer });
    return result.value;
};
