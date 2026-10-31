import { NextResponse } from "next/server";
import { moveCard } from "@/lib/trello";
import type { ListKey } from "@/lib/types";

export const runtime = "nodejs";

/** POST { query, list } -> moves the best-matching open card to that list. */
export async function POST(req: Request) {
  let body: { query?: unknown; list?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 120) : "";
  const list = body.list as ListKey;
  if (!query || !["todo", "doing", "done"].includes(list)) {
    return NextResponse.json({ error: "Say which card and which list." }, { status: 400 });
  }
  try {
    return NextResponse.json(await moveCard(query, list));
  } catch (err) {
    console.error("[move]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status: 500 });
  }
}
