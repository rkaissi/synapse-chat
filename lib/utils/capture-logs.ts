// HTML artifacts run in a sandboxed iframe without allow-same-origin, so the
// app can't reach into them (and they can't reach the app). Their console is
// forwarded with postMessage by a script placed inside the document itself.

const CONSOLE_BRIDGE = `<script>
(function () {
    ["log", "warn", "error"].forEach(function (level) {
        var original = console[level];
        console[level] = function () {
            var args = Array.prototype.slice.call(arguments).map(function (arg) {
                try {
                    return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
                } catch (error) {
                    return String(arg);
                }
            });
            parent.postMessage({ type: "artifact-console", level: level, args: args }, "*");
            original.apply(console, arguments);
        };
    });
    window.addEventListener("error", function (event) {
        parent.postMessage({ type: "artifact-console", level: "error", args: [String(event.message)] }, "*");
    });
})();
</script>`;

// Adds the console bridge as the first script of the document
export const withConsoleBridge = (html: string) => {
    const head = html.match(/<head[^>]*>/i);
    if (head?.index !== undefined) {
        const end = head.index + head[0].length;
        return html.slice(0, end) + CONSOLE_BRIDGE + html.slice(end);
    }
    return CONSOLE_BRIDGE + html;
};

// Listens for console output from one iframe; returns the cleanup
export const captureConsoleLogs = (
    iframe: HTMLIFrameElement,
    callback: (log: string) => void
) => {
    const handleMessage = (event: MessageEvent) => {
        if (
            event.source !== iframe.contentWindow ||
            event.data?.type !== "artifact-console"
        ) {
            return;
        }
        const { level, args } = event.data as { level: string; args: string[] };
        callback(`[${level.toUpperCase()}] ${args.join(" ")}`);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
};
