import React, { useState } from "react";
import {
    PaperAirplaneIcon,
    LightBulbIcon,
    AcademicCapIcon,
    SunIcon,
    BriefcaseIcon,
    CodeBracketIcon,
    PencilIcon,
    GlobeAltIcon,
    CalculatorIcon,
    BeakerIcon,
    ChartPieIcon,
    CubeTransparentIcon,
    ChartBarIcon,
    Square3Stack3DIcon,
    ClockIcon,
    PaintBrushIcon,
    SparklesIcon,
    CloudIcon,
    CakeIcon,
    NewspaperIcon,
    CommandLineIcon,
    ComputerDesktopIcon,
    GlobeAmericasIcon,
    RocketLaunchIcon
    // DocumentTextIcon,
    // WrenchScrewdriverIcon
} from "@heroicons/react/24/outline";

import { NewMessage } from "@/lib/types";

interface Prompt {
    icon: React.ElementType;
    displayName: string;
    prompt: string;
    color: string;
}
// 1: cyan, amber, sky, rose, emerald, violet, gray
// 0: fuchsia, lime

// blue, yellow, green, orange, purple, indigo, indigo, teal, red, cyan, blue, green, purple
// yellow, red, pink, orange, amber, teal, sky, rose, emerald, violet, pink, gray
const prompts: Prompt[] = [
    {
        icon: PaperAirplaneIcon,
        displayName: "Email for plumber quote",
        prompt: "Write an email to request a quote from a plumber for fixing a leaky faucet.",
        color: "bg-blue-100 text-blue-600"
    },
    {
        icon: LightBulbIcon,
        displayName: "Activities to make new friends",
        prompt: "Suggest activities or ways to make new friends after moving to a new city.",
        color: "bg-yellow-100 text-yellow-600"
    },
    {
        icon: AcademicCapIcon,
        displayName: "Study vocabulary",
        prompt: "Create a list of 10 advanced English vocabulary words with their definitions and example sentences.",
        color: "bg-green-100 text-green-600"
    },
    {
        icon: SunIcon,
        displayName: "Plan a relaxing day",
        prompt: "Help me plan a relaxing day off, including activities for self-care and stress relief.",
        color: "bg-orange-100 text-orange-600"
    },
    {
        icon: BriefcaseIcon,
        displayName: "Prepare for job interview",
        prompt: "Give me tips on how to prepare for a software developer job interview.",
        color: "bg-violet-200 text-violet-700"
    },
    {
        icon: CodeBracketIcon,
        displayName: "Explain a coding concept",
        prompt: "Explain the concept of recursion in programming with a simple example.",
        color: "bg-indigo-100 text-indigo-600"
    },
    {
        icon: PencilIcon,
        displayName: "Creative writing prompt",
        prompt: "Give me a creative writing prompt for a short story about time travel.",
        color: "bg-indigo-100 text-indigo-600"
    },
    {
        icon: GlobeAmericasIcon,
        displayName: "Plan a trip",
        prompt: "Help me plan a 7-day trip to Japan, including must-visit places and local cuisine to try.",
        color: "bg-teal-100 text-teal-600"
    },
    {
        icon: CalculatorIcon,
        displayName: "Solve a math problem",
        prompt: "Can you help me solve this calculus problem: Find the derivative of f(x) = x^3 + 2x^2 - 5x + 3.",
        color: "bg-red-200 text-red-700"
    },
    {
        icon: BeakerIcon,
        displayName: "Explain a scientific concept",
        prompt: "Explain the concept of quantum entanglement in simple terms.",
        color: "bg-cyan-100 text-cyan-600"
    },
    {
        icon: ComputerDesktopIcon,
        displayName: "Create a React Dashboard",
        prompt: "Create a comprehensive React dashboard with data visualization, responsive design, and at least three interactive widgets (e.g., line chart, pie chart, and data table). Display this in an artifact.",
        color: "bg-blue-200 text-blue-700"
    },
    {
        icon: CubeTransparentIcon,
        displayName: "Create a Snake Game",
        prompt: "Develop a Snake game using HTML, CSS, and JavaScript as an artifact.",
        color: "bg-green-200 text-green-700"
    },
    {
        icon: ChartPieIcon,
        displayName: "Interactive Pie Chart",
        prompt: "Create an interactive Berkshire Hathaway stock pie chart using React. Using historical stock data, visualize the company's portfolio allocation, and implement hover effects for detailed information. Display this in an artifact.",
        color: "bg-purple-200 text-purple-700"
    },
    {
        icon: Square3Stack3DIcon,
        displayName: "Visualize a Class Diagram",
        prompt: "Generate a comprehensive class diagram using Mermaid for a modern shopping center management system. Include classes for stores, customers, employees, inventory, sales, and facility management. Show relationships, attributes, and methods for each class. Display this in an artifact.",
        color: "bg-lime-100 text-lime-600"
    },
    {
        icon: RocketLaunchIcon,
        displayName: "Create a Simulation in React",
        prompt: "Create a Double Pendulum Physics Simulator in React with an interactive graph. Implement accurate physics calculations, real-time animation, and a graph showing the pendulum's path over time. Include options to adjust parameters like length, mass, and initial angles. Display this in an artifact.",
        color: "bg-fuchsia-100 text-fuchsia-600"
    },
    {
        icon: ClockIcon,
        displayName: "Create a Pomodoro Timer",
        prompt: "Create an aesthetically pleasing Pomodoro timer artifact in React. Include features such as customizable work/break durations, sound notifications, and a visually engaging countdown display. Implement smooth transitions between states and add a productivity tracking feature.",
        color: "bg-emerald-100 text-emerald-600"
    },
    {
        icon: PaintBrushIcon,
        displayName: "Draw an SVG",
        prompt: "Draw an 8-bit style crab SVG artifact. Design a charming and pixelated crab character with attention to detail in the classic 8-bit aesthetic.",
        color: "bg-orange-200 text-orange-700"
    },
    {
        icon: SparklesIcon,
        displayName: "Generate an Image",
        prompt: "Generate an image with the following characteristics: Steampunk Cyborg Yoda with a sparking lightsaber featuring extra swirls of plasma and steam. The richly colored blade should be mostly cybernetic. Set the scene in an old European city with leather and brass details, showcasing full Jules Verne steam era technology. The sparking, spitty cool lightsaber should be prominently featured at dusk.",
        color: "bg-amber-100 text-amber-600"
    },
    {
        icon: CommandLineIcon,
        displayName: "Explain a coding concept",
        prompt: "Create a comprehensive markdown artifact explaining the Array reduce() method in JavaScript. Cover its syntax, use cases, and provide multiple examples demonstrating its versatility. Include comparisons with other array methods, performance considerations, and best practices.",
        color: "bg-gray-200 text-gray-700"
    },
    {
        icon: CloudIcon,
        displayName: "Weather Forecast",
        prompt: "Provide a detailed 3-day weather forecast for Orlando, Florida. Include daily high and low temperatures, precipitation chances, humidity levels, and any notable weather events or warnings.",
        color: "bg-sky-100 text-sky-600"
    },
    {
        icon: ClockIcon,
        displayName: "Current Time in Beijing",
        prompt: "What is the current time in Beijing, China? Also, provide the time difference between Beijing and UTC, and mention any daylight saving time observations if applicable.",
        color: "bg-rose-100 text-rose-600"
    },
    {
        icon: ChartBarIcon,
        displayName: "Graph Yearly Temperatures",
        prompt: "Create a graph showing the average monthly temperatures in Beirut, Lebanon for a typical year. Use a line chart to display the data, with months on the x-axis and temperature in Celsius on the y-axis. Include a brief analysis of the temperature trends throughout the year in ShadCn cards. Preview this as an artifact.",
        color: "bg-emerald-100 text-emerald-600"
    },
    {
        icon: GlobeAltIcon,
        displayName: "Summarize an Article",
        prompt: "Summarize the key points from Ryan Reynolds' Wikipedia page. Include information about his early life, career highlights, notable films, awards, and any significant personal details. Provide a concise yet comprehensive overview of his life and career. Finally, display his image from the article and provide a link to view the full article.",
        color: "bg-violet-100 text-violet-600"
    },
    {
        icon: CakeIcon,
        displayName: "List Cake Recipes",
        prompt: "Search the web for and provide a list of 3 delicious and unique cake recipes that I can create at home. For each recipe, include the name of the cake, a brief description, key ingredients, any special techniques or tips for baking, and a link to the recipe.",
        color: "bg-pink-200 text-pink-700"
    },
    {
        icon: NewspaperIcon,
        displayName: "Recap Yesterday's News",
        prompt: "Provide a concise summary of the major news events that occurred yesterday. Cover important stories from various categories such as international affairs, politics, technology, science, and entertainment. Highlight any breaking news or significant developments that made headlines. Provide the links to the articles used.",
        color: "bg-gray-200 text-gray-700"
    }
];

// Add: Create a presentation in reveal.js about TOPIC
// Add: Summarize this youtube video
// Add: List research articles about this topic
// Add: Search for Lebanon images
// Add: Create an image: An antique anthropological drawing of a victorian-style house. Sketches labelled with handwriting.
// Add: DALLE - Japanese landscape during daytime, a samurai on a motorcycle in the middle with their back to the camera, in anime style

/*
Create a Polaroid photo with VSCO filter, 1990, a gorgeous woman, at night, flash photo, freckled, blonde, cute, young face, sexy, perfect, curvilinear body, salmon coloured bikini, beautiful shadows, tropical plants, inside an apartment, VSCO filter, DSLR
*/

interface Props {
    addMessage: (message: NewMessage) => void;
}

const DefaultPrompts = ({ addMessage }: Props) => {
    const [randomPrompts] = useState<Prompt[]>(() =>
        [...prompts].sort(() => 0.5 - Math.random()).slice(0, 4)
    );

    if (randomPrompts.length === 0) {
        return null;
    }

    return (
        <>
            <div className="flex flex-col items-center justify-center h-full">
                <h2 className="text-2xl font-semibold mb-6 text-gray-700">
                    Choose a prompt to get started
                </h2>
                <div className="grid grid-cols-2 gap-4 w-full max-w-xl mx-auto">
                    {randomPrompts.map((item, index) => (
                        <button
                            key={index}
                            className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 text-center h-full"
                            onClick={() =>
                                addMessage({
                                    role: "user",
                                    content: item.prompt
                                })
                            }
                        >
                            <div
                                className={`w-12 h-12 mb-3 rounded-full flex items-center justify-center ${item.color}`}
                            >
                                <item.icon className={`w-6 h-6`} />
                            </div>
                            <span className="text-sm text-gray-700 line-clamp-2">
                                {item.displayName}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
};

export default DefaultPrompts;
