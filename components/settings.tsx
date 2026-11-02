import React, { memo, useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Action,
    AUTO_PRIORITIES,
    AUTO_ROUTER_MODELS,
    AutoPriority,
    AutoRouterModel,
    Settings,
    ToolChoice
} from "@/lib/types";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    InfoIcon,
    Check,
    ChevronsUpDown,
    ScrollText,
    SlidersHorizontal,
    ToggleRight,
    UserRound,
    Waypoints,
    Wrench
} from "lucide-react";
import {
    MAX_DEFAULT_INSTRUCTION_LENGTH_CHARS,
    tools
} from "@/app/api/chat/config";
import {
    models,
    unsupportedArtifactUseModels,
    unsupportedToolUseModels
} from "@/lib/utils/model-provider";
import ReasoningLevelSelect from "./reasoninglevelselect";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    settings: Settings;
    dispatch: React.Dispatch<Action>;
}

const SECTIONS = [
    { value: "model", label: "Model", icon: SlidersHorizontal },
    { value: "auto", label: "Auto", icon: Waypoints },
    { value: "features", label: "Features", icon: ToggleRight },
    { value: "tools", label: "Tools", icon: Wrench },
    { value: "instructions", label: "Instructions", icon: ScrollText },
    { value: "account", label: "Account", icon: UserRound }
];

const SectionHeading = ({
    title,
    description
}: {
    title: string;
    description: string;
}) => (
    <div className="pb-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
);

const SettingsMenu = ({ isOpen, onClose, settings, dispatch }: Props) => {
    // Auto and Agents route to GPT-6 models (128k output)
    const maxPossibleOutput = models[settings.model].maxTokens || 128000;
    const [toolChoice, setToolChoice] = useState<ToolChoice>(settings.toolChoice);
    const [openCombobox, setOpenCombobox] = useState(false);

    // This browser's anonymous user ID (Account section)
    const [userId, setUserId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState(false);
    useEffect(() => {
        if (!isOpen || userId) return;
        fetch("/api/user")
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => setUserId(data?.userId ?? null))
            .catch(() => {});
    }, [isOpen, userId]);
    const [selectedTool, setSelectedTool] = useState<string>(
        typeof settings.toolChoice === "object"
            ? settings.toolChoice.toolName
            : ""
    );

    // Clamp to the selected model's limit (only when it is exceeded, since
    // settings are persisted)
    useEffect(() => {
        if (settings.maxTokens > maxPossibleOutput) {
            dispatch({ type: "SET_MAX_TOKENS", payload: maxPossibleOutput });
        }
    }, [maxPossibleOutput, settings.maxTokens, dispatch]);

    const handleSetMaxTokens = (value: number) => {
        dispatch({
            type: "SET_MAX_TOKENS",
            payload: Math.min(Math.max(1, value), maxPossibleOutput)
        });
    };

    const handleToolChoiceChange = (value: string) => {
        if (value === "specific") {
            const newToolChoice: ToolChoice = {
                type: "tool",
                toolName: selectedTool || tools[0]
            };
            setToolChoice(newToolChoice);
            dispatch({ type: "SET_TOOL_CHOICE", payload: newToolChoice });
        } else {
            setToolChoice(value as ToolChoice);
            dispatch({ type: "SET_TOOL_CHOICE", payload: value as ToolChoice });
        }
    };

    const handleSpecificToolChange = (tool: string) => {
        setSelectedTool(tool);
        const newToolChoice: ToolChoice = { type: "tool", toolName: tool };
        setToolChoice(newToolChoice);
        dispatch({ type: "SET_TOOL_CHOICE", payload: newToolChoice });
        setOpenCombobox(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="flex h-[min(88vh,680px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px]">
                <DialogHeader className="border-b px-6 py-4 text-left">
                    <DialogTitle className="text-lg font-semibold">
                        Settings
                    </DialogTitle>
                    <DialogDescription>
                        Saved in this browser and used for every chat.
                    </DialogDescription>
                </DialogHeader>
                <Tabs
                    defaultValue="model"
                    orientation="vertical"
                    className="flex min-h-0 flex-1 flex-col sm:flex-row"
                >
                    <TabsList className="h-auto shrink-0 justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-2 sm:w-44 sm:flex-col sm:items-stretch sm:justify-start sm:border-b-0 sm:border-r">
                        {SECTIONS.map(({ value, label, icon: Icon }) => (
                            <TabsTrigger
                                key={value}
                                value={value}
                                className="justify-start gap-2 px-3 py-2 text-sm data-[state=active]:bg-muted data-[state=active]:shadow-none"
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                        <TabsContent value="model" className="mt-0 space-y-4">
                            <SectionHeading
                                title="Model"
                                description="Output length, reasoning effort and how much history is sent."
                            />
                            <div className="flex items-center space-x-4">
                                <Label htmlFor="maxTokens" className="w-36">
                                    Max Tokens
                                </Label>
                                <Slider
                                    id="maxTokens"
                                    min={1}
                                    max={maxPossibleOutput}
                                    step={1}
                                    value={[settings.maxTokens]}
                                    onValueChange={(value) =>
                                        handleSetMaxTokens(value[0])
                                    }
                                    className="w-full"
                                />
                                <Input
                                    type="number"
                                    value={settings.maxTokens}
                                    onChange={(e) =>
                                        handleSetMaxTokens(
                                            Number(e.target.value)
                                        )
                                    }
                                    min={1}
                                    max={maxPossibleOutput}
                                    step={1}
                                    className="w-20"
                                />
                            </div>
                            <div className="flex items-center space-x-4">
                                <Label htmlFor="reasoningLevel" className="w-36 shrink-0">
                                    Reasoning Level
                                </Label>
                                <ReasoningLevelSelect
                                    disabled={settings.model === "auto"}
                                    value={settings.reasoningLevel}
                                    onChange={(value) =>
                                        dispatch({
                                            type: "SET_REASONING_LEVEL",
                                            payload: value
                                        })
                                    }
                                    className="w-full"
                                />
                            </div>
                            {settings.model === "auto" && (
                                <p className="text-xs text-muted-foreground">
                                    Auto picks the reasoning level for each message.
                                </p>
                            )}
                            <div className="flex items-center space-x-4">
                                <div className="flex w-36">
                                    <Label
                                        htmlFor="topP"
                                        className="w-full"
                                    >
                                        Message Limit
                                    </Label>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <InfoIcon className="h-4 w-4 text-gray-500" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="max-w-96 overflow-auto">
                                                    Controls how many
                                                    previous messages are
                                                    passed into context.
                                                    Setting this to 0 means
                                                    all messages are passed
                                                    into context. Setting
                                                    this too high may cause
                                                    the context window to
                                                    fill up.
                                                    <br />
                                                    <br />
                                                    <b>Note:</b> Messages
                                                    outside of the limit are
                                                    automatically
                                                    summarized.
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <Slider
                                    id="topP"
                                    min={0}
                                    max={20}
                                    step={1}
                                    value={[settings.messageLimit]}
                                    onValueChange={(value) =>
                                        dispatch({
                                            type: "SET_MESSAGE_LIMIT",
                                            payload: value[0]
                                        })
                                    }
                                    className="w-full"
                                />
                                <Input
                                    type="number"
                                    value={settings.messageLimit}
                                    onChange={(e) =>
                                        dispatch({
                                            type: "SET_MESSAGE_LIMIT",
                                            payload: Number(e.target.value)
                                        })
                                    }
                                    min={0}
                                    max={20}
                                    step={1}
                                    className="w-20"
                                />
                            </div>
                        </TabsContent>
                        <TabsContent value="auto" className="mt-0 space-y-4">
                            <SectionHeading
                                title="Auto"
                                description="How Auto picks a model for each message."
                            />
                            <div className="flex items-center space-x-4">
                                <Label htmlFor="autoRouterModel" className="w-36 shrink-0">
                                    Auto Router
                                </Label>
                                <Select
                                    value={settings.autoRouterModel}
                                    onValueChange={(value) =>
                                        dispatch({
                                            type: "SET_AUTO_ROUTER_MODEL",
                                            payload: value as AutoRouterModel
                                        })
                                    }
                                >
                                    <SelectTrigger id="autoRouterModel" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(AUTO_ROUTER_MODELS).map(
                                            ([key, label]) => (
                                                <SelectItem key={key} value={key}>
                                                    {label}
                                                </SelectItem>
                                            )
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Groq models are free; Luna Decisions is more accurate.
                            </p>
                            <div className="flex items-center space-x-4">
                                <Label htmlFor="autoPriority" className="w-36 shrink-0">
                                    Auto Priority
                                </Label>
                                <Select
                                    value={settings.autoPriority}
                                    onValueChange={(value) =>
                                        dispatch({
                                            type: "SET_AUTO_PRIORITY",
                                            payload: value as AutoPriority
                                        })
                                    }
                                >
                                    <SelectTrigger id="autoPriority" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(AUTO_PRIORITIES).map(
                                            ([key, label]) => (
                                                <SelectItem key={key} value={key}>
                                                    {label}
                                                </SelectItem>
                                            )
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Cost favors Luna; Performance uses stronger models sooner.
                            </p>
                        </TabsContent>
                        <TabsContent value="features" className="mt-0 space-y-4">
                            <SectionHeading
                                title="Features"
                                description="Enabling many features at once can make each less effective. Artifacts, Logic Mode and Memory work best with stronger models."
                            />
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor="enableArtifacts">
                                            Enable Artifacts
                                        </Label>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <InfoIcon className="h-4 w-4 text-gray-500" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="max-w-96 overflow-auto">
                                                        Artifact generation is
                                                        disabled for the
                                                        following models:{" "}
                                                        <strong>
                                                            {unsupportedArtifactUseModels.join(
                                                                ", "
                                                            )}
                                                        </strong>
                                                        .
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Switch
                                        id="enableArtifacts"
                                        checked={settings.enableArtifacts}
                                        onCheckedChange={(checked) =>
                                            dispatch({
                                                type: "SET_ENABLE_ARTIFACTS",
                                                payload: checked
                                            })
                                        }
                                        disabled={unsupportedArtifactUseModels.includes(
                                            settings.model
                                        )}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor="enableInstructions">
                                            Enable Default Instructions
                                        </Label>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <InfoIcon className="h-4 w-4 text-gray-500" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="max-w-96 overflow-auto">
                                                        This controls whether
                                                        the chatbot uses the
                                                        default supplied
                                                        internal instructions.
                                                        These instructions
                                                        supply the personality,
                                                        behavior, and some of
                                                        the abilities of the
                                                        chatbot.
                                                        <br />
                                                        <br />
                                                        <strong>Note: </strong>
                                                        It is highly recommended
                                                        to keep this setting
                                                        enabled, unless there
                                                        are supplied custom
                                                        instructions that
                                                        explicitly specify chat
                                                        behavior.
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Switch
                                        id="enableInstructions"
                                        checked={settings.enableInstructions}
                                        onCheckedChange={(checked) => {
                                            dispatch({
                                                type: "SET_ENABLE_INSTRUCTIONS",
                                                payload: checked
                                            });
                                            if (!checked) {
                                                dispatch({
                                                    type: "SET_ENABLE_SAFEGUARDS",
                                                    payload: false
                                                });
                                            }
                                        }}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="enableSafeguards">
                                        Enable Additional Safeguards
                                    </Label>
                                    <Switch
                                        id="enableSafeguards"
                                        checked={settings.enableSafeguards}
                                        onCheckedChange={(checked) =>
                                            dispatch({
                                                type: "SET_ENABLE_SAFEGUARDS",
                                                payload: checked
                                            })
                                        }
                                        disabled={!settings.enableInstructions}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="enableLogicMode">
                                        Enable Logic Mode
                                    </Label>
                                    <Switch
                                        id="enableLogicMode"
                                        checked={settings.enableLogicMode}
                                        onCheckedChange={(checked) =>
                                            dispatch({
                                                type: "SET_ENABLE_LOGIC_MODE",
                                                payload: checked
                                            })
                                        }
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="enableMemory">
                                        Enable Memory
                                    </Label>
                                    <Switch
                                        id="enableMemory"
                                        checked={settings.enableMemory}
                                        onCheckedChange={(checked) =>
                                            dispatch({
                                                type: "SET_ENABLE_MEMORY",
                                                payload: checked
                                            })
                                        }
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor="enablePasteToFile">
                                            Enable Paste to File
                                        </Label>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <InfoIcon className="h-4 w-4 text-gray-500" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="max-w-96 overflow-auto">
                                                        Pastes long-form text as
                                                        a plaintext file.
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Switch
                                        id="enablePasteToFile"
                                        checked={settings.enablePasteToFile}
                                        onCheckedChange={(checked) =>
                                            dispatch({
                                                type: "SET_ENABLE_PASTE_TO_FILE",
                                                payload: checked
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="tools" className="mt-0 space-y-4">
                            <SectionHeading
                                title="Tools"
                                description="Which tools the model may call."
                            />
                            <div className="space-y-4 p-1">
                                {unsupportedToolUseModels.includes(
                                    settings.model
                                ) && (
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Tool Use is disabled for this model.
                                        Choose another model to be able to use
                                        tools.
                                    </p>
                                )}
                                <div className="flex flex-col space-y-2">
                                    <Label htmlFor="toolChoice">
                                        Tool Choice Mode
                                    </Label>
                                    <Select
                                        onValueChange={handleToolChoiceChange}
                                        value={
                                            typeof toolChoice === "string"
                                                ? toolChoice
                                                : "specific"
                                        }
                                        disabled={unsupportedToolUseModels.includes(
                                            settings.model
                                        )}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select tool choice" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="auto">
                                                Auto
                                            </SelectItem>
                                            <SelectItem value="required">
                                                Required
                                            </SelectItem>
                                            <SelectItem value="none">
                                                None
                                            </SelectItem>
                                            <SelectItem value="specific">
                                                Specific Tool
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {typeof toolChoice === "object" &&
                                    toolChoice.type === "tool" && (
                                        <div className="flex flex-col space-y-2">
                                            <Label htmlFor="specificTool">
                                                Specific Tool
                                            </Label>
                                            <Popover
                                                open={openCombobox}
                                                onOpenChange={setOpenCombobox}
                                            >
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={
                                                            openCombobox
                                                        }
                                                        className="w-full justify-between"
                                                    >
                                                        {selectedTool ||
                                                            "Select tool..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-full p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search tool..." />
                                                        <CommandEmpty>
                                                            No tool found.
                                                        </CommandEmpty>
                                                        <CommandList>
                                                            <CommandGroup>
                                                                {tools.map(
                                                                    (tool) => (
                                                                        <CommandItem
                                                                            key={
                                                                                tool
                                                                            }
                                                                            value={
                                                                                tool
                                                                            }
                                                                            onSelect={() => {
                                                                                handleSpecificToolChange(
                                                                                    tool
                                                                                );
                                                                                setOpenCombobox(
                                                                                    false
                                                                                );
                                                                            }}
                                                                        >
                                                                            <Check
                                                                                className={cn(
                                                                                    "mr-2 h-4 w-4",
                                                                                    selectedTool ===
                                                                                        tool
                                                                                        ? "opacity-100"
                                                                                        : "opacity-0"
                                                                                )}
                                                                            />
                                                                            {
                                                                                tool
                                                                            }
                                                                        </CommandItem>
                                                                    )
                                                                )}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    )}
                            </div>
                        </TabsContent>
                        <TabsContent value="instructions" className="mt-0 space-y-4">
                            <SectionHeading
                                title="Instructions"
                                description="Added to the system prompt of every chat."
                            />
                            <div className="pt-1">
                                <div
                                    className={`p-1 bg-background rounded-md border relative group overflow-hidden ${
                                        settings.customInstructions.length >=
                                        MAX_DEFAULT_INSTRUCTION_LENGTH_CHARS
                                            ? "focus:border-red-500 focus-within:border-red-500"
                                            : "focus:border-primary focus-within:border-primary"
                                    }`}
                                >
                                    <div className="absolute inset-x-0 bottom-0 h-px bg-transparent transition-all duration-200 group-focus-within:h-[3px] group-focus:h-[3px]">
                                        <div
                                            className={`absolute inset-0 ${
                                                settings.customInstructions
                                                    .length >=
                                                MAX_DEFAULT_INSTRUCTION_LENGTH_CHARS
                                                    ? "bg-red-500"
                                                    : "bg-primary"
                                            }`}
                                            style={{ bottom: "-1px" }}
                                        />
                                    </div>
                                    <textarea
                                        id="customInstructions"
                                        value={settings.customInstructions}
                                        onChange={(e) =>
                                            dispatch({
                                                type: "SET_CUSTOM_INSTRUCTIONS",
                                                payload: e.target.value
                                            })
                                        }
                                        maxLength={
                                            MAX_DEFAULT_INSTRUCTION_LENGTH_CHARS
                                        }
                                        rows={4}
                                        placeholder="Enter your custom instructions"
                                        className="resize-none focus:border-none border-none outline-hidden w-full h-full p-2"
                                    />
                                    <div className="flex justify-end pr-1 pb-1 w-full">
                                        <span className="text-sm text-muted-foreground">
                                            {settings.customInstructions.length}
                                            /
                                            {
                                                MAX_DEFAULT_INSTRUCTION_LENGTH_CHARS
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="account" className="mt-0 space-y-4">
                            <SectionHeading
                                title="Account"
                                description="There's no sign-in yet: your chats and memories are tied to this browser. Another browser or device starts fresh, and clearing site data loses access to them."
                            />
                            <div className="space-y-1.5">
                                <Label>Browser ID</Label>
                                <div className="flex items-center gap-2">
                                    <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 text-xs">
                                        {userId ?? "Loading…"}
                                    </code>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={!userId}
                                        onClick={() => {
                                            if (!userId) return;
                                            navigator.clipboard.writeText(userId);
                                            setCopiedId(true);
                                            setTimeout(() => setCopiedId(false), 2000);
                                        }}
                                    >
                                        {copiedId ? "Copied" : "Copy"}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default memo(SettingsMenu);
