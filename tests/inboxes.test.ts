import { beforeEach, describe, expect, it, vi } from "vitest";

// Several Gmail inboxes on one account: storage, token refresh per inbox, and searching all of them at once.
// Google and the database are replaced with in-memory fakes.

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));
const db = new Map<string, unknown>();
vi.mock("@/lib/store", () => ({
  getJSON: async (k: string) => (db.has(k) ? structuredClone(db.get(k)) : null),
  setJSON: async (k: string, v: unknown) => void (v === null ? db.delete(k) : db.set(k, structuredClone(v))),
}));

const { getMailboxes, getValidAccessToken, removeMailbox, saveMailbox, storeGoogleTokens, GMAIL_SCOPE, CALENDAR_SCOPE } = await import(
  "@/lib/google/oauth"
);
const { listAllMessages, listInboxes } = await import("@/lib/google/gmail");

const HOUR = 3600_000;
const tokens = (access: string, extra: Partial<{ email: string; expiresAt: number; scope: string; refreshToken: string | null }> = {}) => ({
  accessToken: access,
  refreshToken: `refresh-${access}`,
  expiresAt: Date.now() + HOUR,
  scope: `openid email ${GMAIL_SCOPE}`,
  ...extra,
});

/** Fake Gmail: each access token sees its own inbox; "dead" tokens get a 401. */
const inboxByToken: Record<string, { id: string; subject: string; date: string }[]> = {
  "tok-bu": [{ id: "a1", subject: "Your Amazon order", date: "Tue, 20 Oct 2026 10:00:00 -0400" }],
  "tok-personal": [
    { id: "b1", subject: "DoorDash receipt", date: "Thu, 22 Oct 2026 19:00:00 -0400" },
    { id: "b2", subject: "Uber Eats order", date: "Mon, 19 Oct 2026 12:00:00 -0400" },
  ],
};
const calls: string[] = [];
function fakeFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  calls.push(url);
  const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    return json({ access_token: "tok-personal-fresh", expires_in: 3600, scope: `openid email ${GMAIL_SCOPE}`, token_type: "Bearer" });
  }
  if (url.startsWith("https://oauth2.googleapis.com/revoke")) return json({});
  const token = String((init?.headers as Record<string, string>)?.Authorization ?? "").replace("Bearer ", "");
  const box = inboxByToken[token.replace("-fresh", "")];
  if (!box) return json({ error: "unauthorized" }, 401);
  const one = url.match(/\/messages\/([^?]+)\?/);
  if (one) {
    const m = box.find((x) => x.id === one[1])!;
    return json({ id: m.id, threadId: m.id, snippet: "", payload: { headers: [{ name: "Subject", value: m.subject }, { name: "From", value: "shop@example.com" }, { name: "Date", value: m.date }] } });
  }
  return json({ messages: box.map((m) => ({ id: m.id, threadId: m.id })) });
}

beforeEach(() => {
  db.clear();
  calls.length = 0;
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});

describe("several inboxes", () => {
  it("lists the main connection first, then the extra inboxes", async () => {
    await storeGoogleTokens("u1", tokens("tok-bu", { email: "me@bu.edu", scope: `openid email ${GMAIL_SCOPE} ${CALENDAR_SCOPE}` }));
    await saveMailbox("u1", "me.personal@gmail.com", tokens("tok-personal", { email: "me.personal@gmail.com" }));
    expect(await listInboxes("u1")).toEqual([
      { account: "primary", email: "me@bu.edu", primary: true },
      { account: "me.personal@gmail.com", email: "me.personal@gmail.com", primary: false },
    ]);
  });

  it("works with only an extra inbox and no main Gmail connection", async () => {
    await saveMailbox("u1", "me.personal@gmail.com", tokens("tok-personal"));
    expect((await listInboxes("u1")).map((i) => i.account)).toEqual(["me.personal@gmail.com"]);
  });

  it("searches every inbox, newest first, and tags each email with its inbox", async () => {
    await storeGoogleTokens("u1", tokens("tok-bu", { email: "me@bu.edu" }));
    await saveMailbox("u1", "me.personal@gmail.com", tokens("tok-personal"));
    const { messages, failed } = await listAllMessages("u1", "receipt", 30);
    expect(failed).toEqual([]);
    expect(messages.map((m) => [m.subject, m.account])).toEqual([
      ["DoorDash receipt", "me.personal@gmail.com"],
      ["Your Amazon order", "primary"],
      ["Uber Eats order", "me.personal@gmail.com"],
    ]);
  });

  it("reports an inbox it can't read but still returns the others", async () => {
    await storeGoogleTokens("u1", tokens("tok-bu"));
    await saveMailbox("u1", "old@gmail.com", tokens("dead", { refreshToken: null }));
    const { messages, failed } = await listAllMessages("u1", "receipt", 30);
    expect(messages).toHaveLength(1);
    expect(failed).toEqual(["old@gmail.com"]);
  });

  it("fails outright only when no inbox can be read", async () => {
    await saveMailbox("u1", "old@gmail.com", tokens("dead", { refreshToken: null }));
    await expect(listAllMessages("u1", "receipt", 30)).rejects.toThrow(/token/);
  });

  it("refreshes an expired extra inbox and saves the new token to that inbox only", async () => {
    await storeGoogleTokens("u1", tokens("tok-bu"));
    await saveMailbox("u1", "me.personal@gmail.com", tokens("tok-personal", { expiresAt: Date.now() - 1000, email: "me.personal@gmail.com" }));
    expect(await getValidAccessToken("u1", "me.personal@gmail.com")).toBe("tok-personal-fresh");
    const [box] = await getMailboxes("u1");
    expect(box.tokens).toMatchObject({ accessToken: "tok-personal-fresh", refreshToken: "refresh-tok-personal", email: "me.personal@gmail.com" });
    expect(await getValidAccessToken("u1")).toBe("tok-bu");
  });

  it("re-linking an inbox updates it, keeps its refresh token, and the list is capped", async () => {
    for (const n of [1, 2, 3, 4]) expect(await saveMailbox("u1", `a${n}@gmail.com`, tokens(`t${n}`))).toBe(true);
    expect(await saveMailbox("u1", "a5@gmail.com", tokens("t5"))).toBe(false);
    expect(await saveMailbox("u1", "a2@gmail.com", tokens("t2-new", { refreshToken: null }))).toBe(true);
    const boxes = await getMailboxes("u1");
    expect(boxes).toHaveLength(4);
    expect(boxes[1].tokens).toMatchObject({ accessToken: "t2-new", refreshToken: "refresh-t2" });
  });

  it("removing an inbox revokes it at Google and leaves the rest", async () => {
    await saveMailbox("u1", "a@gmail.com", tokens("ta"));
    await saveMailbox("u1", "b@gmail.com", tokens("tb"));
    await removeMailbox("u1", "a@gmail.com");
    expect((await getMailboxes("u1")).map((m) => m.email)).toEqual(["b@gmail.com"]);
    expect(calls.some((c) => c.includes("/revoke?token=refresh-ta"))).toBe(true);
  });

  it("can't reach another student's inboxes", async () => {
    await saveMailbox("u1", "a@gmail.com", tokens("ta"));
    expect(await getValidAccessToken("u2", "a@gmail.com")).toBeNull();
  });
});
