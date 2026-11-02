import { cookies } from "next/headers";
import { isValidUserId, USER_COOKIE } from "./user-id";

// The current browser's user ID (set by proxy.ts), or null without one
export const getUserId = async (): Promise<string | null> => {
    const id = (await cookies()).get(USER_COOKIE)?.value;
    return isValidUserId(id) ? id : null;
};
