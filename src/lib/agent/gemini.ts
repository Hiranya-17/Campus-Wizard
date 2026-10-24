import "server-only";
import type { ChatCard, ChatMessage, Profile } from "@/lib/types";
import { TOOL_DECLARATIONS, runTool } from "@/lib/agent/tools";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type Part = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: unknown };
type Content = { role: "user" | "model"; parts: Part[] };

function systemPrompt(profile: Profile): string {
  return `You are Rhett, a friendly personal assistant for Boston University students (named after BU's mascot).
You help with: getting to class on time (when to leave, walk vs Green Line), registration planning from the student's major sheet and prerequisites, planning their week around classes and clubs, and finding the cheapest delivery app for the same food order.

Rules:
- Use tools for facts about courses, plans and prices. Never invent course codes, times or prices.
- Before plan_week, if the student hasn't told you, ask in ONE short message: wake-up time, hours of sleep, study hours per day, gym days per week, and any weekly to-dos (like calling parents). Then call plan_week with their answers.
- Keep replies short and scannable: 2-5 sentences or a few bullets. The app shows plan details as cards under your reply, so summarize instead of listing every event.
- Mention BU specifics when useful: Convenience Points, FitRec, Mugar, the BU shuttle.
- You are an AI assistant, not an official BU service; for registration holds or policy questions, point to the student's advisor or Student Link.

Student profile: ${JSON.stringify({ ...profile, semester: profile.semester ? profile.semester.courses.map((c) => c.code) : undefined })}
Today is ${new Date().toDateString()}.`;
}

export async function runGemini(messages: ChatMessage[], profile: Profile): Promise<{ reply: string; cards: ChatCard[] }> {
  const key = process.env.GEMINI_API_KEY!;
  const contents: Content[] = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const cards: ChatCard[] = [];

  for (let step = 0; step < 6; step++) {
    const call = () => fetch(`${URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25000), // fall back to rules rather than hang the demo
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(profile) }] },
        contents,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      }),
    });
    let res = await call();
    // Gemini is sometimes briefly overloaded; one retry usually works
    if (res.status === 503 || res.status === 429) res = await call();
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const content: Content | undefined = data.candidates?.[0]?.content;
    if (!content?.parts?.length) return { reply: "Sorry, I didn't catch that. Could you rephrase?", cards };
    contents.push(content);

    const calls = content.parts.filter((p) => p.functionCall);
    if (!calls.length) {
      return { reply: content.parts.map((p) => p.text ?? "").join("").trim(), cards };
    }
    const responses: Part[] = await Promise.all(
      calls.map(async ({ functionCall }) => {
        const { result, card } = await runTool(functionCall!.name, functionCall!.args ?? {}, profile);
        if (card) cards.push(card);
        return { functionResponse: { name: functionCall!.name, response: { result } } };
      }),
    );
    contents.push({ role: "user", parts: responses });
  }
  return { reply: "That took too many steps. Try asking one thing at a time.", cards };
}
