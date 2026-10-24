import "server-only";
import { GMAIL_SCOPE, PRIMARY, getGoogleTokens, getMailboxes, getValidAccessToken, hasScope } from "@/lib/google/oauth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;       // ISO string
  snippet: string;
  /** Heuristic label: "club" for newsletters, "order" for purchase confirmations */
  kind: "club" | "order" | "other";
  /** Which inbox it came from: "primary" or an extra inbox's address */
  account: string;
}

export interface GmailMessageBody {
  id: string;
  subject: string;
  from: string;
  date: string;
  text: string;       // plain text, HTML tags stripped
  kind: GmailMessageSummary["kind"];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Decode Gmail's base64url-encoded message parts. */
function b64urlDecode(s: string): string {
  // Gmail uses base64url (- and _ instead of + and /)
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/** Very light HTML → plain text: strip tags, decode common entities. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Walk a MIME message part tree and collect plain-text content. */
interface MimePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: MimePart[];
}

function extractText(part: MimePart): string {
  if (!part) return "";
  const mime: string = part.mimeType ?? "";

  if (mime === "text/plain" && part.body?.data) {
    return b64urlDecode(part.body.data);
  }
  if (mime === "text/html" && part.body?.data) {
    return htmlToText(b64urlDecode(part.body.data));
  }
  if (part.parts) {
    // multipart/alternative: prefer text/plain; else use first part
    const plain = part.parts.find((p) => p.mimeType === "text/plain");
    if (plain) return extractText(plain);
    return part.parts.map(extractText).join("\n").trim();
  }
  return "";
}

/** Pull a header value from the message payload headers array. */
interface RawHeader { name?: string; value?: string }

function header(headers: RawHeader[], name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** Heuristic: is this an order confirmation email? */
function detectKind(subject: string, from: string, snippet: string): GmailMessageSummary["kind"] {
  const orderRe = /order\s*confirm|receipt|your\s*order|shipped|delivery\s*confirm|invoice|payment\s*confirm|purchased/i;
  const clubRe = /club|team|org|society|newsletter|meeting|event|seminar|workshop|hackathon|bsa|bu\s+\w+\s+club/i;
  const text = `${subject} ${from} ${snippet}`;
  if (orderRe.test(text)) return "order";
  if (clubRe.test(text)) return "club";
  return "other";
}

// ---------------------------------------------------------------------------
// Gmail API wrappers
// ---------------------------------------------------------------------------

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch(userId: string, path: string, account: string): Promise<unknown> {
  const token = await getValidAccessToken(userId, account);
  if (!token) throw new Error("No valid Google token. Please reconnect Google.");

  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Google token expired. Please reconnect Google.");
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Fetch the 30 most recent emails matching the query.
 * Default query targets club newsletters and order confirmations relevant to a BU student.
 */
export async function listMessages(
  userId: string,
  query = "in:inbox newer_than:30d",
  maxResults = 30,
  account: string = PRIMARY,
): Promise<GmailMessageSummary[]> {
  const list = (await gmailFetch(
    userId,
    `/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}&fields=messages(id,threadId),nextPageToken`,
    account,
  )) as { messages?: { id: string; threadId: string }[] };

  if (!list.messages?.length) return [];

  // Fetch metadata for each message in parallel (capped to 30)
  const summaries = await Promise.all(
    list.messages.map(async ({ id }) => {
      const msg = (await gmailFetch(
        userId,
        `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&fields=id,threadId,snippet,payload(headers)`,
        account,
      )) as { id: string; threadId: string; snippet?: string; payload?: { headers?: unknown[] } };

      const headers = (msg.payload?.headers ?? []) as { name: string; value: string }[];
      const from = header(headers, "From");
      const subject = header(headers, "Subject");
      const rawDate = header(headers, "Date");
      const date = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
      const snippet = msg.snippet ?? "";

      return {
        id: msg.id,
        threadId: msg.threadId,
        from,
        subject,
        date,
        snippet,
        kind: detectKind(subject, from, snippet),
        account,
      } satisfies GmailMessageSummary;
    }),
  );

  // Sort newest first
  return summaries.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Fetch one message and return its decoded plain-text body.
 */
export async function getMessage(userId: string, messageId: string, account: string = PRIMARY): Promise<GmailMessageBody> {
  const msg = (await gmailFetch(
    userId,
    `/messages/${messageId}?format=full&fields=id,payload`,
    account,
  )) as { id: string; payload?: MimePart & { headers?: RawHeader[] } };

  const payload = msg.payload;
  const headers = payload?.headers ?? [];
  const subject = header(headers, "Subject");
  const from = header(headers, "From");
  const rawDate = header(headers, "Date");
  const date = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
  const text = (payload ? extractText(payload) : "").slice(0, 60_000);

  return {
    id: msg.id,
    subject,
    from,
    date,
    text,
    kind: detectKind(subject, from, text.slice(0, 400)),
  };
}

// ---------------------------------------------------------------------------
// Several inboxes
// ---------------------------------------------------------------------------

export interface Inbox {
  account: string; // "primary" or the extra inbox's address
  email: string | null; // null for a main connection made before addresses were saved
  primary: boolean;
}

/** Every inbox this student has linked with Gmail access: the main connection first, then the extras. */
export async function listInboxes(userId: string): Promise<Inbox[]> {
  const [primary, extras] = await Promise.all([getGoogleTokens(userId), getMailboxes(userId)]);
  const inboxes: Inbox[] = hasScope(primary, GMAIL_SCOPE) ? [{ account: PRIMARY, email: primary?.email ?? null, primary: true }] : [];
  for (const m of extras) if (m.email !== primary?.email || !inboxes.length) inboxes.push({ account: m.email, email: m.email, primary: false });
  return inboxes;
}

/** Search every linked inbox at once, newest first. An inbox that fails (e.g. access revoked) is reported, not fatal. */
export async function listAllMessages(
  userId: string,
  query: string,
  maxPerInbox: number,
): Promise<{ messages: GmailMessageSummary[]; failed: string[] }> {
  const inboxes = await listInboxes(userId);
  const results = await Promise.all(
    inboxes.map((i) => listMessages(userId, query, maxPerInbox, i.account).then((m) => ({ ok: true as const, m }), () => ({ ok: false as const, i }))),
  );
  const messages = results.flatMap((r) => (r.ok ? r.m : []));
  const failed = results.flatMap((r) => (r.ok ? [] : [r.i.email ?? "your main Google account"]));
  if (inboxes.length && failed.length === inboxes.length) throw new Error("No valid Google token. Please reconnect Google.");
  return { messages: messages.sort((a, b) => b.date.localeCompare(a.date)), failed };
}
