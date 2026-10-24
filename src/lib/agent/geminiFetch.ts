import "server-only";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

/** POST to Gemini generateContent, retrying when it's briefly overloaded (503/429). */
export async function geminiGenerate(body: unknown): Promise<{ candidates?: { content?: { role: "model"; parts: Record<string, unknown>[] } }[] }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25000), // fall back to rules rather than hang the demo
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    if ((res.status === 503 || res.status === 429) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); // 1s, 2s, 4s
      continue;
    }
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}
