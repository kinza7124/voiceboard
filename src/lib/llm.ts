import { sanitizeTask } from "./tasks";
import type { Extraction, Task } from "./types";

const SYSTEM_PROMPT = `You turn messy, spoken meeting brain-dumps into clean task lists.

Rules:
- Output ONLY valid JSON. No prose, no markdown fences.
- Schema: { "summary": string, "decisions": string[], "tasks": [ { "title": string, "owner": string|null, "due": string|null, "priority": "high"|"medium"|"low", "status": "todo"|"doing"|"done", "notes": string } ] }
- One task per distinct action item. Split compound sentences into separate tasks.
- "title": short, imperative, under 70 characters (e.g. "Book offsite venue").
- "owner": the first name of the person responsible, exactly as spoken. If the speaker says "I", use "Me". If nobody is named or it is unclear, use null.
- "due": ISO date YYYY-MM-DD resolved relative to TODAY (provided by the user). "Friday" means the next upcoming Friday. "End of next week" means the Friday of next week. "In two weeks" means today plus 14 days. If no deadline is mentioned, use null.
- "priority": "high" if the speaker signals urgency (urgent, ASAP, critical, today, blocking), "low" if they signal no rush, otherwise "medium".
- "status": "doing" if the speaker says the work is already in progress or started ("already working on it", "in progress", "started"); "done" if they say it is already finished ("already done", "finished", "completed", "shipped"); otherwise "todo".
- "notes": one short sentence of useful context from the dump; empty string if none.
- "summary": one sentence (max 140 characters) saying what the dump was about; empty string if there was nothing meaningful.
- "decisions": decisions or agreements the speaker states (not action items), each under 100 characters; empty array if none.
- Ignore chit-chat, filler words, and anything that is not an action item.
- Never invent tasks, names, decisions or dates that were not said.
- If the speaker corrects themselves ("actually make that Thursday"), use the corrected value.`;

export class ModelParseError extends Error {}

function parseExtraction(raw: string): Extraction {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const data = JSON.parse(cleaned);
  if (!data || !Array.isArray(data.tasks)) throw new Error("missing tasks array");
  return {
    summary: typeof data.summary === "string" ? data.summary.trim().slice(0, 200) : "",
    decisions: Array.isArray(data.decisions)
      ? data.decisions.map((d: unknown) => String(d).trim().slice(0, 140)).filter(Boolean).slice(0, 6)
      : [],
    tasks: (data.tasks as unknown[]).map(sanitizeTask).filter((t): t is Task => t !== null),
  };
}

async function callGemini(userMessage: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

export async function extractTasks(transcript: string, today: string): Promise<Extraction> {
  const weekday = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
  // A literal calendar keeps "Friday" / "next week" resolution deterministic.
  const [y, m, d] = today.split("-").map(Number);
  const upcoming = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(Date.UTC(y, m - 1, d + i + 1));
    return `${day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${day.toISOString().slice(0, 10)}`;
  }).join(", ");
  const userMessage =
    `TODAY: ${today} (${weekday})\n` +
    `NEXT 14 DAYS (excluding today): ${upcoming}\n` +
    `A bare weekday name means its first occurrence in that list, never today.\n\n` +
    `TRANSCRIPT:\n${transcript}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callGemini(userMessage);
    console.log("[llm raw]", text);
    try {
      return parseExtraction(text);
    } catch (err) {
      console.warn(`[llm] parse failed (attempt ${attempt + 1})`, err);
    }
  }
  throw new ModelParseError("Could not understand the model response");
}
