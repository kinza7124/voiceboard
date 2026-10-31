import { NextResponse } from "next/server";
import { extractTasks, ModelParseError } from "@/lib/llm";
import { createCards } from "@/lib/trello";

export const runtime = "nodejs";
export const maxDuration = 60; // Gemini on the free tier can be slow; the default serverless limit is too short

/**
 * POST { transcript, today, preview? }
 *  - preview: true  -> { summary, decisions, tasks }  (nothing is written to Trello)
 *  - otherwise      -> { summary, decisions, cards }  (extract and create in one go)
 */
export async function POST(req: Request) {
  let body: { transcript?: unknown; today?: unknown; preview?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json({ error: "Nothing to process, the text is empty." }, { status: 400 });
  }
  if (transcript.length > 5000) {
    return NextResponse.json({ error: "That is too long (max 5,000 characters)." }, { status: 400 });
  }
  const today =
    typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Date().toISOString().slice(0, 10);

  try {
    const result = await extractTasks(transcript, today);
    if (body.preview === true) return NextResponse.json(result);
    if (!result.tasks.length) {
      return NextResponse.json({ cards: [], summary: result.summary, decisions: result.decisions });
    }
    const cards = await createCards(result.tasks);
    return NextResponse.json({ cards, summary: result.summary, decisions: result.decisions });
  } catch (err) {
    console.error("[process]", err);
    if (err instanceof ModelParseError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
