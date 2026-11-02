// Anonymous per-browser users (until real accounts exist). proxy.ts gives
// every browser a random ID in an httpOnly cookie; the server reads it with
// getUserId() (lib/user.ts) and never trusts a user ID sent by the client.

export const USER_COOKIE = "synapse_uid";

// A year and a month (browsers cap cookie lifetimes at 400 days)
export const USER_COOKIE_MAX_AGE = 60 * 60 * 24 * 395;

// Random UUIDs only, so IDs can't be guessed (the legacy "1" user is not
// accepted; see scripts/claim-legacy-chats.mjs)
export const isValidUserId = (id: string | undefined | null): id is string =>
    !!id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
