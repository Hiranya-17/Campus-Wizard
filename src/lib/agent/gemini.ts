import "server-only";
import { geminiGenerate } from "@/lib/agent/geminiFetch";
import type { ChatCard, ChatMessage, Profile } from "@/lib/types";
import { TOOL_DECLARATIONS, runTool } from "@/lib/agent/tools";


type Part = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: unknown };
type Content = { role: "user" | "model"; parts: Part[] };

function systemPrompt(profile: Profile): string {
  return `You are Rhett, a friendly personal assistant for Boston University students (named after BU's mascot).
You help with: tracking their semester budget and logging purchases, getting to class on time (when to leave, walk vs Green Line), registration planning from the student's major sheet and prerequisites, planning their week around classes and clubs, and finding the cheapest delivery app for the same food order.

Rules:
- Use tools for facts about courses, plans and prices. Never invent course codes, times or prices.
- Registration: the student builds their own schedule for the term on the Plan page. Use list_sections to answer questions about sections (times, professors, clashes), add_course / remove_course to change the schedule when they ask, check_schedule to review clashes and prerequisites, and plan_semester only when they want a whole schedule suggested. "completed" in the profile means courses taken BEFORE this term.
- Before plan_week, if the student hasn't told you, ask in ONE short message: wake-up time, hours of sleep, study hours per day, gym days per week, and any weekly to-dos (like calling parents). Then call plan_week with their answers.
- Keep replies short and scannable: 2-5 sentences or a few bullets. The app shows plan details as cards under your reply, so summarize instead of listing every event.
- Mention BU specifics when useful: Convenience Points, FitRec, Mugar, the BU shuttle.
- You are an AI assistant, not an official BU service; for registration holds or policy questions, point to the student's advisor or Student Link.

Student profile: ${JSON.stringify({ ...profile, semester: profile.semester ? profile.semester.courses.map((c) => `${c.code} ${c.sections.map((s) => s.section).join("+")}`) : undefined, expenses: profile.expenses ? `${profile.expenses.length} logged (use budget_summary)` : undefined })}
Today is ${new Date().toDateString()}.`;
}

export async function runGemini(messages: ChatMessage[], profile: Profile): Promise<{ reply: string; cards: ChatCard[] }> {
  const contents: Content[] = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const cards: ChatCard[] = [];

  for (let step = 0; step < 6; step++) {
    const data = await geminiGenerate({
      systemInstruction: { parts: [{ text: systemPrompt(profile) }] },
      contents,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    });
    const content = data.candidates?.[0]?.content as Content | undefined;
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
