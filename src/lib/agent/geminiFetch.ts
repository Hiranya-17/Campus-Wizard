import "server-only";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

// When the daily quota is used up, skip Gemini until it resets instead of retrying every message.
let quotaResetAt = 0;

/** POST to Gemini generateContent, retrying when it's briefly overloaded (503/429). */
export async function geminiGenerate(body: unknown): Promise<{ candidates?: { content?: { role: "model"; parts: Record<string, unknown>[] } }[] }> {
  if (Date.now() < quotaResetAt) throw new Error("Gemini daily quota used up; using rules until it resets");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25000), // fall back to rules rather than hang the demo
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    if (res.status === 429) {
      const text = await res.text();
      if (/PerDay/.test(text)) {
        // Pause for at most 10 minutes, so enabling billing (higher limits) takes effect quickly
        const wait = Math.min(600, Number(text.match(/"retryDelay":\s*"(\d+)s"/)?.[1] ?? 600));
        quotaResetAt = Date.now() + wait * 1000;
        throw new Error(`Gemini daily quota used up; retrying in ${Math.round(wait / 60)} min`);
      }
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      throw new Error(`Gemini 429: ${text.slice(0, 300)}`);
    }
    if (res.status === 503 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); // 1s, 2s, 4s
      continue;
    }
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}
