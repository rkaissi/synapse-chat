import { Converter } from "showdown";
import {
    showdownKatex,
    showdownFootnotes,
    showdownImage,
    showdownLink,
    showdownUnclosedCode
} from "@/lib/showdown-extensions";
import DOMPurify from "dompurify";
import { highlightCodeBlocks } from "@/lib/showdown-extensions/showdown-code";

// Separates the HTML of top-level markdown blocks. CustomMarkdown only
// replaces the blocks that changed, so a streaming reply doesn't rebuild
// everything above the block that is still being written
export const BLOCK_SEPARATOR = "<!--block-->";

// Separates the HTML of a message's text segments (see MessageSegment)
export const SEGMENT_SEPARATOR = "<!--segment-->";

// Unfenced HTML documents and <style> blocks would be rendered into the app
// itself and restyle it (e.g. an agent returning a whole page as text). Show
// them as code instead; live previews belong in the sandboxed artifact iframe.
// Also matches unterminated blocks, which happen while a reply streams.
const RAW_PAGE_PATTERN =
    /(?:<!DOCTYPE html|<html[\s>])[\s\S]*?(?:<\/html>|$)|<style[\s>][\s\S]*?(?:<\/style>|$)/gi;

const fenceRawHtml = (markdown: string) =>
    markdown
        // Odd segments are inside ``` fences and stay as they are
        .split(/(```[\s\S]*?(?:```|$))/)
        .map((segment, index) =>
            index % 2 === 1
                ? segment
                : segment.replace(
                      RAW_PAGE_PATTERN,
                      (block) => "\n```html\n" + block.trim() + "\n```\n"
                  )
        )
        .join("");

// Any indentation, so fences inside list items are tracked too
const FENCE_OPEN = /^\s*(`{3,}|~{3,})/;
const FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:\s|$)/;
// Blocks that can depend on markdown elsewhere in the document (reference
// links) or span blank lines (raw HTML). Such documents are converted whole
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]^][^\]]*\]:\s*\S/;
const HTML_LINE = /^ {0,3}<\/?[a-zA-Z][\w-]*(?:[\s>/]|$)/;

/**
 * Splits markdown at blank lines that end a top-level block: never inside
 * code fences or $$ math, and not before indented lines or list items (list
 * items stay together so loose lists aren't split into separate lists).
 */
const splitBlocks = (markdown: string): string[] => {
    const blocks: string[] = [];
    let current: string[] = [];
    let fence: string | null = null;
    let inMath = false;
    let afterBlank = false;

    for (const line of markdown.split("\n")) {
        if (fence) {
            const close = line.match(FENCE_CLOSE);
            if (
                close &&
                close[1][0] === fence[0] &&
                close[1].length >= fence.length
            ) {
                fence = null;
            }
            current.push(line);
            continue;
        }

        if (line.trim() === "") {
            afterBlank = current.length > 0;
            current.push(line);
            continue;
        }

        if (REFERENCE_DEFINITION.test(line) || HTML_LINE.test(line)) {
            return [markdown];
        }

        if (
            afterBlank &&
            !inMath &&
            !/^\s/.test(line) &&
            !LIST_ITEM.test(line)
        ) {
            blocks.push(current.join("\n"));
            current = [];
        }
        afterBlank = false;

        const open = line.match(FENCE_OPEN);
        if (open) {
            fence = open[1];
        } else if ((line.match(/\$\$/g)?.length ?? 0) % 2 === 1) {
            inMath = !inMath;
        }
        current.push(line);
    }

    if (current.length > 0) blocks.push(current.join("\n"));
    return blocks;
};

let converter: Converter | null = null;

const getConverter = () => {
    if (converter) return converter;
    converter = new Converter({
        tables: true,
        ghCodeBlocks: true,
        strikethrough: true,
        tasklists: true,
        ghMentions: true,
        smoothLivePreview: true,
        smartIndentationFix: true,
        disableForced4SpacesIndentedSublists: true,
        simpleLineBreaks: true,
        requireSpaceBeforeHeadingText: true,
        omitExtraWLInCodeBlocks: true,
        openLinksInNewWindow: true,
        simplifiedAutoLink: true,
        emoji: true,
        encodeEmails: false,
        ghCompatibleHeaderId: true,
        extensions: [
            showdownKatex,
            showdownFootnotes,
            showdownImage,
            showdownLink,
            showdownUnclosedCode
        ]
    });
    converter.setFlavor("github");
    return converter;
};

// Converted blocks, so finished blocks aren't converted again on every
// streamed update (and re-rendering a chat doesn't redo every message)
const MAX_CACHED_BLOCKS = 500;
const blockCache = new Map<string, string>();

const convertBlock = (markdown: string) => {
    const cached = blockCache.get(markdown);
    if (cached !== undefined) {
        // Move to the end so the least recently used block is evicted first
        blockCache.delete(markdown);
        blockCache.set(markdown, cached);
        return cached;
    }

    // Code is highlighted after sanitizing: DOMPurify then only walks the
    // escaped code, not the many highlight spans, which halves the cost of a
    // streaming code block. The highlighted markup is generated by
    // showdownCode from that escaped text
    const html = highlightCodeBlocks(
        DOMPurify.sanitize(getConverter().makeHtml(markdown))
    );
    blockCache.set(markdown, html);
    if (blockCache.size > MAX_CACHED_BLOCKS) {
        blockCache.delete(blockCache.keys().next().value!);
    }
    return html;
};

const markdownToHtml = (markdown: string) =>
    splitBlocks(fenceRawHtml(markdown))
        .filter((block) => block.trim() !== "")
        .map(convertBlock)
        .join(BLOCK_SEPARATOR);

export default markdownToHtml;
