import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import {
    BlendIcon,
    BookOpenIcon,
    GaugeIcon,
    LayoutPanelLeftIcon,
    LightbulbIcon,
    MessageSquarePlusIcon,
    MessageSquareTextIcon,
    MessagesSquareIcon,
    SettingsIcon,
    SparklesIcon,
    PanelLeftIcon,
    PanelRightIcon,
    GroupIcon,
    FishSymbolIcon
} from "lucide-react";
import { AutoIcon, SparkleIcon, ZapIcon } from "./icons";
import { isModelAvailable, ModelKey, ModelProvider } from "@/lib/utils/model-provider";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { dispatchNewChat } from "@/lib/utils/new-chat";

export const modelInfo: Partial<
    Record<
        ModelKey,
        {
            name: string;
            description: string;
            icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
            provider: ModelProvider;
        }
    >
> = {
    // Listed first: the "Modes" group heads the picker
    auto: {
        name: "Auto",
        description:
            "Picks the model and reasoning effort for each message.",
        icon: AutoIcon,
        provider: ModelProvider.Other
    },
    agents: {
        name: "Agents",
        description: "A team of specialized agents plans, works and reviews.",
        icon: MessagesSquareIcon,
        provider: ModelProvider.Other
    },
    claudeopus55: {
        name: "Claude Opus 5.5",
        description:
            "Anthropic's most capable model for complex reasoning, coding and agentic work.",
        icon: LightbulbIcon,
        provider: ModelProvider.Anthropic
    },
    claudesonnet55: {
        name: "Claude Sonnet 5.5",
        description:
            "Anthropic's balance of intelligence and speed for everyday work.",
        icon: SparklesIcon,
        provider: ModelProvider.Anthropic
    },
    claudehaiku55: {
        name: "Claude Haiku 5.5",
        description: "Anthropic's fastest model for near-instant responses.",
        icon: ZapIcon,
        provider: ModelProvider.Anthropic
    },
    claudefable51: {
        name: "Claude Fable 5.1",
        description: "Anthropic's Fable model.",
        icon: MessageSquareTextIcon,
        provider: ModelProvider.Anthropic
    },
    gpt6astra: {
        name: "GPT-6 Astra",
        description:
            "OpenAI's flagship model for complex reasoning and coding.",
        icon: GroupIcon,
        provider: ModelProvider.OpenAI
    },
    gpt61sol: {
        name: "GPT-6.1 Sol",
        description:
            "Near-Astra performance for complex work at a lower cost.",
        icon: SparkleIcon,
        provider: ModelProvider.OpenAI
    },
    gpt61terra: {
        name: "GPT-6.1 Terra",
        description:
            "Fast, efficient model for visual reasoning and natural writing.",
        icon: MessageSquareTextIcon,
        provider: ModelProvider.OpenAI
    },
    gpt6luna: {
        name: "GPT-6 Luna",
        description: "OpenAI's most efficient model for everyday tasks.",
        icon: ZapIcon,
        provider: ModelProvider.OpenAI
    },
    gptoss120b: {
        name: "GPT-OSS 120B",
        description:
            "OpenAI's open-weight reasoning model with tool use, hosted on Groq.",
        icon: BookOpenIcon,
        provider: ModelProvider.Groq
    },
    gptoss20b: {
        name: "GPT-OSS 20B",
        description:
            "Smaller, very fast open-weight reasoning model from OpenAI on Groq.",
        icon: GaugeIcon,
        provider: ModelProvider.Groq
    },
    qwen38_27b: {
        name: "Qwen 3.8 27B",
        description: "Open-weight thinking model from Alibaba Cloud on Groq.",
        icon: BlendIcon,
        provider: ModelProvider.Groq
    },
};

interface Props {
    artifacts: boolean;
    isArtifactsOpen: boolean;
    setIsArtifactsOpen: (open: boolean) => void;
    selectedModel: ModelKey;
    onModelSelect: (model: ModelKey) => void;
    onOpenSettings: () => void;
    isSidebarOpen: boolean;
    onSidebarOpenChange: (open: boolean) => void;
}

const ChatHeader = ({
    artifacts,
    isArtifactsOpen,
    setIsArtifactsOpen,
    selectedModel,
    onModelSelect,
    onOpenSettings,
    isSidebarOpen,
    onSidebarOpenChange
}: Props) => {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    const handleModelChange = (model: ModelKey) => {
        onModelSelect(model);
    };

    const getModelDisplayName = (modelKey: ModelKey) => {
        return modelInfo[modelKey]?.name;
    };

    const groupedModels = useMemo(() => {
        return Object.entries(modelInfo).reduce((acc, [key, value]) => {
            // Premium models are hidden unless enabled (see isModelAvailable)
            if (value && isModelAvailable(key as ModelKey)) {
                const provider = value.provider;
                if (!acc[provider]) {
                    acc[provider] = [];
                }
                acc[provider].push({ key: key as ModelKey, ...value });
            }
            return acc;
        }, {} as Record<ModelProvider, Array<{ key: ModelKey } & NonNullable<(typeof modelInfo)[ModelKey]>>>);
    }, []);

    return (
        <header className="flex align-middle justify-center w-full bg-background text-foreground py-3 px-4 md:px-6 border-b">
            <div className="flex container items-center justify-between mx-auto">
                <div className="flex items-center gap-3">
                    <Button
                        variant="default"
                        size="icon"
                        onClick={() => onSidebarOpenChange(!isSidebarOpen)}
                        aria-label={
                            isSidebarOpen ? "Close sidebar" : "Open sidebar"
                        }
                    >
                        {isSidebarOpen ? (
                            <PanelLeftIcon className="h-5 w-5" />
                        ) : (
                            <PanelRightIcon className="h-5 w-5" />
                        )}
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Open new chat"
                        onClick={() => {
                            router.push("/");
                            dispatchNewChat();
                        }}
                    >
                        <MessageSquarePlusIcon className="h-5 w-5" />
                    </Button>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="gap-1 rounded-md px-3 h-10 text-lg justify-between"
                            >
                                {getModelDisplayName(selectedModel)}
                                <ChevronDownIcon className="w-4 h-4 text-muted-foreground ml-2 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                            <Command>
                                <CommandInput
                                    placeholder="Search model..."
                                    className="h-9"
                                />
                                <CommandList>
                                    <CommandEmpty>No model found.</CommandEmpty>
                                    {Object.entries(groupedModels).map(
                                        ([provider, models], index) => (
                                            <CommandGroup
                                                key={provider}
                                                heading={
                                                    provider === ModelProvider.Other
                                                        ? "Modes"
                                                        : provider
                                                }
                                            >
                                                {index > 0 && (
                                                    <CommandSeparator />
                                                )}
                                                {models.map((model) => {
                                                    const Icon = model.icon;
                                                    return (
                                                        <CommandItem
                                                            key={model.key}
                                                            onSelect={() => {
                                                                handleModelChange(
                                                                    model.key
                                                                );
                                                                setOpen(false);
                                                            }}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <Icon className="w-4 h-4 shrink-0" />
                                                            <div>
                                                                <div className="font-medium">
                                                                    {model.name}
                                                                </div>
                                                                <div className="text-sm text-muted-foreground">
                                                                    {
                                                                        model.description
                                                                    }
                                                                </div>
                                                            </div>
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        )
                                    )}
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="flex space-x-2">
                    {artifacts && !isArtifactsOpen && (
                        <Button
                            variant="outline"
                            size="default"
                            onClick={() => setIsArtifactsOpen(true)}
                            className="ml-auto"
                        >
                            <LayoutPanelLeftIcon className="w-4 h-4 mr-2" />
                            Open Artifacts
                        </Button>
                    )}
                    <Button
                        variant="default"
                        size="icon"
                        onClick={onOpenSettings}
                        aria-label="Open settings"
                    >
                        <SettingsIcon className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </header>
    );
};

export default ChatHeader;
