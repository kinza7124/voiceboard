import { NextResponse } from "next/server";
import { sanitizeTask } from "@/lib/tasks";
import { createCards } from "@/lib/trello";
import type { Task } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/** POST { tasks } -> { cards }. Creates reviewed (possibly user-edited) tasks on Trello. */
export async function POST(req: Request) {
  let body: { tasks?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const tasks = (Array.isArray(body.tasks) ? body.tasks : [])
    .slice(0, 30)
    .map(sanitizeTask)
    .filter((t): t is Task => t !== null);
  if (!tasks.length) return NextResponse.json({ error: "No valid tasks to create." }, { status: 400 });

  try {
    return NextResponse.json({ cards: await createCards(tasks) });
  } catch (err) {
    console.error("[create]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status: 500 });
  }
}
