import { NextRequest, NextResponse } from "next/server";
import { isValidUserId, USER_COOKIE, USER_COOKIE_MAX_AGE } from "@/lib/user-id";

// Gives each browser an anonymous user ID on its first request (Next 16's
// proxy, formerly middleware). The ID is also added to that first request,
// so its page and API calls already see it.
export function proxy(request: NextRequest) {
    if (isValidUserId(request.cookies.get(USER_COOKIE)?.value)) {
        return NextResponse.next();
    }

    const userId = crypto.randomUUID();
    request.cookies.set(USER_COOKIE, userId);
    const response = NextResponse.next({ request: { headers: request.headers } });
    response.cookies.set(USER_COOKIE, userId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: USER_COOKIE_MAX_AGE,
        path: "/"
    });
    return response;
}

export const config = {
    // Pages and API routes, not static assets
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"]
};
