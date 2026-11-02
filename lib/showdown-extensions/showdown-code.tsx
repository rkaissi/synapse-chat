import showdown from "showdown";
import { decodeHTML } from "@/lib/utils/decode-html";
import { highlightCode } from "@/lib/utils/highlight";

// Comprehensive language to file extension mapping
const languageExtensionMap: { [key: string]: string } = {
    // Web Development
    typescript: "ts",
    javascript: "js",
    html: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    jsx: "jsx",
    tsx: "tsx",
    php: "php",

    // Configuration & Data
    json: "json",
    yaml: "yaml",
    yml: "yml",
    toml: "toml",
    xml: "xml",
    ini: "ini",
    env: "env",

    // Programming Languages
    python: "py",
    java: "java",
    cpp: "cpp",
    c: "c",
    csharp: "cs",
    go: "go",
    rust: "rs",
    swift: "swift",
    kotlin: "kt",
    ruby: "rb",
    perl: "pl",
    lua: "lua",
    r: "r",
    scala: "scala",
    dart: "dart",

    // Shell & Scripts
    bash: "sh",
    shell: "sh",
    powershell: "ps1",
    batch: "bat",

    // Database
    sql: "sql",
    plsql: "pls",
    mongodb: "mongodb",

    // Markup & Documentation
    markdown: "md",
    latex: "tex",
    restructuredtext: "rst",
    asciidoc: "adoc",

    // Mobile & Framework-specific
    objectivec: "m",
    gradle: "gradle",
    vue: "vue",
    svelte: "svelte",

    // Other
    dockerfile: "dockerfile",
    makefile: "makefile",
    graphql: "graphql",
    plaintext: "txt",

    // Generic fallbacks for syntax groups
    markup: "txt",
    style: "css",
    script: "js",
    config: "conf"
};

// Helper function to get file extension and display name
const getLanguageInfo = (lang: string) => {
    // Normalize language identifier
    const normalizedLang = lang.toLowerCase().replace(/^language-/, "");

    // Get file extension
    const extension = languageExtensionMap[normalizedLang] || "txt";

    // Get display name (capitalize first letter of each word)
    const displayName = normalizedLang
        .split(/[._-]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    return { extension, displayName };
};

// Turns <pre><code class="language-x"> blocks into highlighted code blocks
// with copy and download buttons. markdownToHtml runs it on sanitized HTML
export const highlightCodeBlocks = (text: string) => {
    const codeRegex =
        /<pre><code\s+class="([^"]+)">([\s\S]*?)<\/code><\/pre>/g;

    return text.replace(
        codeRegex,
        (match, language: string, code: string) => {
            const decodedCode = decodeHTML(code).trim();
            // The language comes from the model's code fence and is
            // inserted into the markup below, so keep it to safe characters
            const lang =
                (language.split("language-")[1] || "").replace(
                    /[^\w#+.-]/g,
                    ""
                ) || "plaintext";

            const { value: highlightedCode, language: detectedLang } =
                highlightCode(decodedCode, lang);

            const { extension, displayName } =
                getLanguageInfo(detectedLang);

            // Generate a default filename based on language
            const defaultFilename = `code.${extension}`;

            return `
<div class="code-block" data-extension="${extension}" data-language="${detectedLang}">
  <div class="code-header">
    <div class="flex items-center gap-2">
      <span class="code-lang">${displayName}</span>
      <span class="code-file-ext text-gray-400 text-sm">.${extension}</span>
    </div>
    <div class="flex gap-2">
      <button class="copy-code-button inline-flex items-center hover:bg-gray-600 p-1.5 rounded-md" title="Copy code">
        <svg class="copy-icon w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
        <span class="button-text hidden">Copy code</span>
      </button>
      <button class="download-code-button inline-flex items-center hover:bg-gray-600 p-1.5 rounded-md" 
              title="Download code"
              data-filename="${defaultFilename}">
        <svg class="download-icon w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" x2="12" y1="15" y2="3" />
        </svg>
        <span class="button-text hidden">Download</span>
      </button>
    </div>
  </div>
  <pre class="code-pre"><code class="hljs ${detectedLang}">${highlightedCode}</code></pre>
</div>`;
        }
    );
};

const showdownCode: showdown.ShowdownExtension = {
    type: "output",
    filter: highlightCodeBlocks
};

export default showdownCode;
