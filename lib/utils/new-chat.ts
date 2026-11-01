// Dispatched by the "new chat" button; the home page listens for it to reset
// a conversation that was started on "/" (see app/page.tsx)
export const NEW_CHAT_EVENT = "synapse:new-chat";

export const dispatchNewChat = () =>
    window.dispatchEvent(new Event(NEW_CHAT_EVENT));
