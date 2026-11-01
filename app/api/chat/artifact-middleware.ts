import type { LanguageModelMiddleware } from 'ai';

export interface ExtractedArtifact {
    identifier: string;
    type: string;
    language: string;
    title: string;
    content: string;
    isComplete: boolean;
}

/**
 * Helper function to extract attribute values from artifact tags
 */
export function getAttributeValue(attributes: string, attr: string): string {
    const match = attributes.match(new RegExp(`${attr}="([^"]*)"`));
    return match ? match[1] : "";
}

/**
 * Extract artifacts from text content
 */
export function extractArtifacts(content: string): {
    cleanedContent: string;
    artifacts: ExtractedArtifact[];
} {
    if (!content.includes("<assistantArtifact")) {
        return {
            cleanedContent: content,
            artifacts: []
        };
    }

    let cleanedContent = content;
    const artifacts: ExtractedArtifact[] = [];
    
    const artifactStartRegex = /<assistantArtifact([^>]*)>/;
    const artifactEndRegex = /<\/assistantArtifact>/;
    
    let startMatch = cleanedContent.match(artifactStartRegex);
    
    while (startMatch && startMatch.index !== undefined) {
        const attributes = startMatch[1];
        const identifier = getAttributeValue(attributes, "identifier");
        const type = getAttributeValue(attributes, "type");
        const language = getAttributeValue(attributes, "language");
        const title = getAttributeValue(attributes, "title");
        
        const endMatch = cleanedContent.match(artifactEndRegex);
        
        if (endMatch && endMatch.index !== undefined) {
            // Complete artifact
            const artifactContent = cleanedContent
                .substring(startMatch.index + startMatch[0].length, endMatch.index)
                .trim()
                .replace(/^```[\w-]*\n|\n```$/g," ")
                .trim();
            
            artifacts.push({
                identifier,
                type,
                language,
                title,
                content: artifactContent,
                isComplete: true
            });
            
            // Replace artifact with placeholder in cleaned content
            cleanedContent = `${cleanedContent.substring(0, startMatch.index)}[ARTIFACT:${identifier}]${cleanedContent.substring(endMatch.index + endMatch[0].length)}`;
        } else {
            // Incomplete artifact (streaming case)
            const artifactContent = cleanedContent
                .substring(startMatch.index + startMatch[0].length)
                .trim()
                .replace(/^```[\w-]*\n|\n```$/g, "")
                .trim();
            
            artifacts.push({
                identifier,
                type,
                language,
                title,
                content: artifactContent,
                isComplete: false
            });
            
            // Replace with placeholder
            cleanedContent = `${cleanedContent.substring(0, startMatch.index)}[ARTIFACT:${identifier}]`;
            break; // Stop processing since this is streaming
        }
        
        // Look for next artifact
        startMatch = cleanedContent.match(artifactStartRegex);
    }
    
    return {
        cleanedContent,
        artifacts
    };
}

/**
 * Middleware to extract artifacts from AI model responses
 * This middleware processes complete (non-streaming) responses only
 */
export const artifactExtractionMiddleware: LanguageModelMiddleware = {
    wrapGenerate: async ({ doGenerate }) => {
        const result = await doGenerate();

        return {
            ...result,
            content: result.content.map((part) =>
                part.type === "text"
                    ? { ...part, text: extractArtifacts(part.text).cleanedContent }
                    : part
            )
        };
    }
};
