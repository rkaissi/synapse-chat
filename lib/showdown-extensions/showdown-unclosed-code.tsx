import { ShowdownExtension } from "showdown";

const FENCE = /^\s*(`{3,}|~{3,})/;

// Closes a code block that is still being streamed, so it renders as code
// rather than as text. Tracks fences line by line: the previous regex
// backtracked through every closed block, which took quadratic time
const showdownUnclosedCode: ShowdownExtension = {
    type: "lang",
    filter: function (text: string) {
        let fence: string | null = null;

        for (const line of text.split("\n")) {
            const match = line.match(FENCE);
            if (!match) continue;
            if (!fence) {
                fence = match[1];
            } else if (
                match[1][0] === fence[0] &&
                match[1].length >= fence.length &&
                line.trim() === match[1]
            ) {
                fence = null;
            }
        }

        if (!fence) return text;
        return text.replace(/\n+$/, "") + "\n" + fence;
    }
};

export default showdownUnclosedCode;
