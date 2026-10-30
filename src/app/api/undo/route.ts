import { NextResponse } from "next/server";
import { archiveCards } from "@/lib/trello";

export const runtime = "nodejs";

/** POST { ids } -> { archived }. Archives (never deletes) the given cards, so it is reversible in Trello. */
export async function POST(req: Request) {
  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const ids = (Array.isArray(body.ids) ? body.ids : []).filter(
    (id): id is string => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id)
  );
  if (!ids.length || ids.length > 30) return NextResponse.json({ error: "Nothing to undo." }, { status: 400 });

  try {
    return NextResponse.json({ archived: await archiveCards(ids) });
  } catch (err) {
    console.error("[undo]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status: 500 });
  }
}
