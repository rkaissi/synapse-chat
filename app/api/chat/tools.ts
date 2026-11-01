import { tool } from "ai";
import { z } from "zod";
import OpenAI from "openai";

import { YoutubeTranscript } from "youtube-transcript";
import { formatTime } from "@/lib/utils/format";
import { createAgentNetwork } from "@/lib/agents";
import executeJavaScript from "@/lib/tools/eval";
import { artifactExtractionMiddleware } from "./artifact-middleware";

const openai = new OpenAI();

const WIKIPEDIA_USER_AGENT =
    "SynapseChat (https://github.com/GameGenesis/ai-chat-artifacts)";

const fetchJson = async (url: string | URL, init?: RequestInit) => {
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(
            `Request to ${new URL(url).host} failed with status ${response.status}`
        );
    }
    return response.json();
};

const agentNetwork = createAgentNetwork();

export const createAgentsTool = (previousAssistantMessage: string) =>
    tool({
        description:
            "Call upon agents to perform a specific task. Once you receive their response, double-check and verify it for any issues or missing information. If any arise, add a note amending them. Output a formatted final response to the user.",
        inputSchema: z.object({
            project: z
                .string()
                .describe(
                    "The original prompt or task description. Be specific and include all key information."
                ),
            context: z
                .string()
                .optional()
                .describe(
                    "The agents do not have any context of this conversation or any messages including this one. Provide the agents with context to complete the task. This can include previous messages in the conversation, previous essay drafts, or the current version of the code. Ensure all necessary context is included in full. Do not add new information, as the project manager agent will plan the instructions to complete the task."
                )
        }),
        execute: async ({ project, context }) => {
            console.log("### Agents ###");
            try {
                const messages = await agentNetwork.executePrompt(
                    project,
                    `${context}.\n\n## Previous user content:\n${previousAssistantMessage}`
                );

                return {
                    status: "Success: Tasks completed successfully!",
                    messages
                };
            } catch (error) {
                return {
                    status: "Error: Fulfill the user request without calling the agents. Preface the response with this error",
                    error: `An error occurred while trying to receive the agents' responses. Error ${error}.`
                };
            }
        }
    });

export const tools = {
    get_current_time: tool({
        description: "Get the current time",
        inputSchema: z.object({
            timeZone: z
                .string()
                .describe(
                    "The time zone to get the time for. This can be deduced from the location. Format: IANA Time Zone Database / Olson Time Zone Database / TZ Database (e.g. Asia/Beirut)."
                )
                .default("America/New_York")
        }),
        execute: async ({ timeZone }) => ({
            time: new Date().toLocaleTimeString("en-us", {
                hour: "numeric",
                minute: "numeric",
                hour12: true,
                timeZone
            })
        })
    }),
    generate_dalle_image: tool({
        description: "Generate an image (using DALLE)",
        inputSchema: z.object({
            prompt: z
                .string()
                .describe("The prompt used to generate the image"),
            size: z
                .enum([
                    "1024x1024",
                    "256x256",
                    "512x512",
                    "1792x1024",
                    "1024x1792"
                ])
                .describe("The size of the image")
                .default("1024x1024")
        }),
        execute: async ({ prompt, size }) => {
            const response = await openai.images.generate({
                model: "dall-e-3",
                prompt,
                n: 1,
                size
            });
            
            if (!response.data || response.data.length === 0) {
                throw new Error("No image generated");
            }
            
            return {
                url: response.data[0].url
            };
        }
    }),
    get_youtube_video_transcript: tool({
        description:
            "Retrieve the complete transcript of a YouTube video using its video ID",
        inputSchema: z.object({
            videoId: z
                .string()
                .describe(
                    "The unique identifier of the YouTube video. For example, the video ID for 'https://www.youtube.com/watch?v=jNQXAC9IVRw' is 'jNQXAC9IVRw'."
                )
        }),
        execute: async ({ videoId }) => {
            const data = await YoutubeTranscript.fetchTranscript(videoId);
            return {
                transcript: data
                    .map(
                        (line) =>
                            `[${formatTime(Math.floor(line.offset))}] ${
                                line.text
                            }`
                    )
                    .join("\n")
                    .replaceAll("&amp;#39;", "'")
            };
        }
    }),
    execute_javascript: tool({
        description:
            "Executes JavaScript code in the browser and returns any results. This tool is useful for evaluating mathematical expressions, running small code snippets, or performing simple calculations. Note that console logs do nothing in this environment.",
        inputSchema: z.object({
            javascript: z.string().describe("The JavaScript code to execute.")
        }),
        execute: async ({ javascript }) => ({
            result: executeJavaScript(javascript)
        })
    }),
    // extract_artifacts: tool({
    //     description:
    //         "Extract artifacts from AI response text that contains assistantArtifact tags. This tool processes the text and separates artifacts from regular content.",
    //     parameters: z.object({
    //         content: z.string().describe("The text content that may contain artifact tags.")
    //     }),
    //     execute: async ({ content }) => {
    //         const { extractArtifacts } = await import("@/lib/utils/artifact-extraction");
    //         const { cleanedContent, artifacts } = extractArtifacts(content);
    //         return {
    //             cleanedContent,
    //             artifacts,
    //             hasArtifacts: artifacts.length > 0
    //         };
    //     }
    // }),
    // evaluate_math_expression: tool({
    //     description:
    //         "A tool for evaluating mathematical expressions. " +
    //         "Example expressions: " +
    //         "'1.2 * (2 + 4.5)', '12.7 cm to inch', 'sin(45 deg) ^ 2'.",
    //     parameters: z.object({ expression: z.string() }),
    //     execute: async ({ expression }) => evaluate(expression)
    // }),
    // arxiv_search: tool({
    //     description:
    //         "Search for scientific papers on arXiv. Use this for academic or research purposes",
    //     parameters: z.object({
    //         query: z.string().describe("The search query for arXiv"),
    //         maxResults: z
    //             .number()
    //             .min(1)
    //             .max(10)
    //             .default(5)
    //             .describe("The maximum number of results to return (1-10)")
    //     }),
    //     execute: async ({ query, maxResults }) => {
    //         try {
    //             const results = await searchArxiv(query, maxResults);
    //             return {
    //                 results: results.map((result: ArxivResult) => ({
    //                     title: result.title,
    //                     summary: result.summary,
    //                     authors: result.authors.join(", "),
    //                     published: result.published,
    //                     url: result.id
    //                 }))
    //             };
    //         } catch (error) {
    //             console.error("Error searching arXiv:", error);
    //             return { error: "Failed to search arXiv" };
    //         }
    //     }
    // }),
    // web_search_preview: openai.tools.webSearchPreview(),
    // The following tools previously came from @agentic/*, which does not support AI SDK 5+.
    // Names and result shapes are kept so the tool cards and saved chats keep working.
    get_current_weather: tool({
        description: "Gets info about the current weather at a given location.",
        inputSchema: z.object({
            q: z
                .string()
                .describe(
                    'Location to get the weather for. Can be a city name, zipcode, IP address, or lat/lng coordinates. Example: "London"'
                )
        }),
        execute: async ({ q }) => {
            const url = new URL("https://api.weatherapi.com/v1/current.json");
            url.searchParams.set("key", process.env.WEATHER_API_KEY ?? "");
            url.searchParams.set("q", q);
            return fetchJson(url);
        }
    }),
    wikipedia_search: tool({
        description: "Searches Wikipedia for pages matching the given query.",
        inputSchema: z.object({
            query: z.string().describe("Search query")
        }),
        execute: async ({ query }) => {
            const url = new URL(
                "https://en.wikipedia.org/w/rest.php/v1/search/page"
            );
            url.searchParams.set("q", query);
            return fetchJson(url, {
                headers: { "api-user-agent": WIKIPEDIA_USER_AGENT }
            });
        }
    }),
    wikipedia_get_page_summary: tool({
        description: "Gets a summary of the given Wikipedia page.",
        inputSchema: z.object({
            title: z.string().describe("Wikipedia page title"),
            acceptLanguage: z
                .string()
                .optional()
                .default("en-us")
                .describe("Locale code for the language to use.")
        }),
        execute: async ({ title, acceptLanguage }) => {
            const page = encodeURIComponent(title.trim().replaceAll(" ", "_"));
            return fetchJson(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${page}?redirect=true`,
                {
                    headers: {
                        "accept-language": acceptLanguage,
                        "api-user-agent": WIKIPEDIA_USER_AGENT
                    }
                }
            );
        }
    }),
    bing_web_search: tool({
        description:
            "Searches the web using the Bing search engine to return the most relevant web pages for a given query. Can also be used to find up-to-date news and information about many topics.",
        inputSchema: z.object({
            q: z.string().describe("search query")
        }),
        execute: async ({ q }) => {
            const url = new URL("https://api.bing.microsoft.com/v7.0/search");
            url.searchParams.set("q", q);
            url.searchParams.set("mkt", "en-US");
            const { rankingResponse, ...result } = await fetchJson(url, {
                headers: {
                    "Ocp-Apim-Subscription-Key": process.env.BING_API_KEY ?? ""
                }
            });
            return result;
        }
    })
};

// Export the artifact extraction middleware
export { artifactExtractionMiddleware };
