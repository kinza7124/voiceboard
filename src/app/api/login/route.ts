import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

const sha = (s: string) => createHash("sha256").update(s).digest();

export async function POST(req: Request) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return NextResponse.json({ ok: true });

  let given = "";
  try {
    given = String((await req.json()).passcode ?? "");
  } catch {
    /* treated as wrong */
  }
  if (!timingSafeEqual(sha(given), sha(passcode))) {
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("vb_auth", createHash("sha256").update(`${passcode}:voiceboard`).digest("hex"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
