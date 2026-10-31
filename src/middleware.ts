import { NextResponse, type NextRequest } from "next/server";

export const config = { matcher: ["/((?!_next/|favicon.ico).*)"] };

async function tokenFor(passcode: string) {
  const data = new TextEncoder().encode(`${passcode}:voiceboard`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Optional passcode gate. When APP_PASSCODE is set (production), every page and API route
 * needs the login cookie, so strangers cannot write to the connected Trello board.
 * Unset locally, so development is unchanged.
 */
export async function middleware(req: NextRequest) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  if (req.cookies.get("vb_auth")?.value === (await tokenFor(passcode))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized. Sign in first." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}
