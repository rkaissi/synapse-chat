import { withConsoleBridge } from "@/lib/utils/capture-logs";
import { Artifact } from "@/lib/types";
import { memo } from "react";
import dynamic from "next/dynamic";
import { LoadingSpinner } from "./icons";

const ErrorMessage = dynamic(
    () => import("./errormessage").then((mod) => mod.ErrorMessage),
    {
        loading: () => <LoadingSpinner />,
        ssr: false
    }
);

const CustomMarkdown = dynamic(
    () => import("./markdown").then((mod) => mod.CustomMarkdown),
    {
        loading: () => <LoadingSpinner />,
        ssr: false
    }
);

const ReactRenderer = dynamic(
    () => import("./reactrenderer").then((mod) => mod.default),
    {
        loading: () => <LoadingSpinner />,
        ssr: false
    }
);

const Mermaid = dynamic(() => import("./mermaid").then((mod) => mod.Mermaid), {
    loading: () => <LoadingSpinner />,
    ssr: false
});

interface Props {
    artifact: Artifact;
    setConsoleLogs: React.Dispatch<React.SetStateAction<string[]>>;
    html: string;
    iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

const PreviewComponent = ({
    artifact,
    setConsoleLogs,
    html,
    iframeRef
}: Props) => {
    if (!artifact) return null;

    switch (artifact.type) {
        case "image/svg+xml":
            return (
                <div
                    dangerouslySetInnerHTML={{
                        __html: artifact.content || ""
                    }}
                />
            );
        case "text/html":
            return (
                <iframe
                    ref={iframeRef}
                    srcDoc={withConsoleBridge(artifact.content || "")}
                    style={{
                        width: "100%",
                        height: "100%",
                        border: "none"
                    }}
                    title={artifact.title || "Preview"}
                    // No allow-same-origin: with it, artifact scripts could
                    // reach window.parent and modify the app
                    sandbox="allow-scripts allow-forms allow-modals allow-popups"
                />
            );
        case "application/react":
            // ReactRenderer and Mermaid report their own errors
            return (
                <ReactRenderer
                    code={artifact.content || ""}
                    setConsoleLogs={setConsoleLogs}
                />
            );
        case "application/mermaid":
            return <Mermaid chart={artifact.content || ""} />;
        case "text/markdown":
            return (
                <CustomMarkdown
                    className="h-full px-4 overflow-y-auto"
                    html={html || artifact.content || ""}
                />
            );
        default:
            return (
                <ErrorMessage
                    title="Unsupported Artifact"
                    message={`The artifact type "${artifact.type}" is not supported.`}
                />
            );
    }
};

export default memo(PreviewComponent);
