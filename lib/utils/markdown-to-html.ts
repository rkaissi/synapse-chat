import { Converter } from "showdown";
import {
    showdownKatex,
    showdownFootnotes,
    showdownImage,
    showdownCode,
    showdownLink,
    showdownUnclosedCode
} from "@/lib/showdown-extensions";
import DOMPurify from "dompurify";

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

const markdownToHtml = (markdown: string) => {
    const converter = new Converter({
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
            showdownUnclosedCode,
            showdownCode
        ]
    });
    converter.setFlavor("github");
    const html = converter.makeHtml(fenceRawHtml(markdown));
    return DOMPurify.sanitize(html);
};

export default markdownToHtml;
