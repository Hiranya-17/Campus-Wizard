import "server-only";
import { extractWithRules } from "@/lib/agent/extract";
import { geminiGenerate } from "@/lib/agent/geminiFetch";
import { getMessage, listMessages, type GmailMessageBody } from "@/lib/google/gmail";
import type { Day, ExtractedEvent } from "@/lib/types";
import { DAYS } from "@/lib/types";

/**
 * Gmail search for the emails clubs and orgs send: meetings, socials, workshops, info sessions.
 * Promotions and social-network notifications are skipped.
 */
export const CLUB_QUERY =
  'newer_than:30d -category:promotions -category:social (meeting OR meetings OR "general body" OR GBM OR club OR workshop OR "info session" OR rehearsal OR practice OR "join us" OR rsvp OR event OR newsletter)';

const MAX_EMAILS = 15;
const CHARS_PER_EMAIL = 2500;

const SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      email: { type: "integer", description: "number of the email it came from, as given" },
      title: { type: "string", description: 'short, e.g. "Robotics Club general meeting"' },
      weekday: { type: "string", nullable: true, enum: DAYS, description: "for meetings that repeat every week" },
      date: { type: "string", nullable: true, description: "YYYY-MM-DD for one-time events" },
      start: { type: "integer", nullable: true, description: "minutes after midnight" },
      end: { type: "integer", nullable: true, description: "minutes after midnight" },
      location: { type: "string", nullable: true },
    },
    required: ["email", "title"],
  },
};

export interface ScannedEvent extends ExtractedEvent {
  emailId: string;
}

export interface GmailScanResult {
  scanned: number; // emails read
  events: ScannedEvent[];
  engine: "gemini" | "rules";
}

const label = (m: GmailMessageBody) => `${m.subject || "(no subject)"} · ${m.from.replace(/<.*>/, "").trim()}`;

/** Search the student's inbox, read the matching emails, and pull out every meeting/event with its source email. */
export async function scanInboxForEvents(userId: string): Promise<GmailScanResult> {
  const list = await listMessages(userId, CLUB_QUERY, MAX_EMAILS);
  const emails = (await Promise.all(list.slice(0, MAX_EMAILS).map((m) => getMessage(userId, m.id).catch(() => null)))).filter(
    (m): m is GmailMessageBody => m !== null && m.text.trim().length > 0,
  );
  if (!emails.length) return { scanned: 0, events: [], engine: "rules" };

  if (process.env.GEMINI_API_KEY) {
    try {
      const text = emails
        .map((m, i) => `=== Email ${i + 1}\nFrom: ${m.from}\nSubject: ${m.subject}\nSent: ${m.date}\n\n${m.text.slice(0, CHARS_PER_EMAIL)}`)
        .join("\n\n");
      const data = await geminiGenerate({
        contents: [{
          role: "user",
          parts: [{
            text: `These are a Boston University student's recent emails. List every club meeting, social, workshop, info session, rehearsal or practice they could attend.
Use weekday for meetings that repeat every week, and date (YYYY-MM-DD) for one-time events. Skip deadlines with no event, ads, sales and anything already in the past.
Today is ${new Date().toDateString()}. Times are minutes after midnight (7:00 pm = 1140).

${text}`,
          }],
        }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA },
      });
      const raw: { email?: number; title?: string; weekday?: string; date?: string; start?: number; end?: number; location?: string }[] =
        JSON.parse((data.candidates?.[0]?.content?.parts?.[0]?.text as string) ?? "[]");
      const events = raw
        .map((r): ScannedEvent | null => {
          const m = emails[(r.email ?? 0) - 1];
          if (!m || !r.title) return null;
          return {
            title: String(r.title).slice(0, 60),
            weekday: DAYS.includes(r.weekday as Day) ? (r.weekday as Day) : null,
            date: r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null,
            start: typeof r.start === "number" ? r.start : null,
            end: typeof r.end === "number" ? r.end : null,
            location: r.location ?? null,
            kind: "club",
            source: label(m),
            emailId: m.id,
          };
        })
        .filter((e): e is ScannedEvent => e !== null);
      return { scanned: emails.length, events, engine: "gemini" };
    } catch (e) {
      console.error("gmail scan", e);
    }
  }
  // no AI available: read each email line by line
  const events = emails.flatMap((m) =>
    extractWithRules({ kind: "email", text: m.text, source: label(m) })
      .filter((e) => e.kind === "club")
      .map((e) => ({ ...e, emailId: m.id })),
  );
  return { scanned: emails.length, events, engine: "rules" };
}
