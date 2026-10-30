"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const BOARD_ID = process.env.NEXT_PUBLIC_TRELLO_BOARD_ID;
export const BOARD_URL = BOARD_ID ? `https://trello.com/b/${BOARD_ID}` : undefined;

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Shared page frame: holographic backdrop, pale panel, hairline grid, header nav and footer.
 * It flows with its content, so it works from phones to wide desktops.
 */
export function Shell({
  active,
  actions,
  stickers,
  children,
}: {
  active: "home" | "board";
  actions?: React.ReactNode;
  stickers?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState("");
  const [viewport, setViewport] = useState("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`);
    };
    const size = () => setViewport(`${String(window.innerWidth).padStart(4, "0")} x ${String(window.innerHeight).padStart(4, "0")} Y`);
    tick();
    size();
    const t = setInterval(tick, 1000);
    window.addEventListener("resize", size);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", size);
    };
  }, []);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    el.style.setProperty("--mx", `${x}px`);
    el.style.setProperty("--my", `${y}px`);
    el.style.setProperty("--px", String((x / r.width - 0.5) * 2));
    el.style.setProperty("--py", String((y / r.height - 0.5) * 2));
  }

  const navLink = (href: string, label: string, key: "home" | "board") => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`t-label underline-offset-[6px] hover:underline ${active === key ? "font-bold underline" : "opacity-70"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex min-h-screen justify-center p-3 sm:p-6">
      <div
        ref={panelRef}
        onMouseMove={onMove}
        className="panel relative flex w-full max-w-[1180px] flex-col overflow-hidden p-5 shadow-[0_40px_90px_rgba(10,30,120,0.35)] sm:p-7"
      >
        {/* hairline column guides */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
          {[33.33, 66.66].map((x) => (
            <div key={x} className="absolute inset-y-0 w-px bg-[#07162b]/10" style={{ left: `${x}%` }} />
          ))}
        </div>

        <header className="relative z-30 flex items-start justify-between gap-4 border-b border-[#07162b]/15 pb-4">
          <span className="t-label font-bold">VoiceBoard.app</span>
          <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 sm:gap-x-7">
            {navLink("/", "Home", "home")}
            {navLink("/board", "Board", "board")}
            {BOARD_URL && (
              <a href={BOARD_URL} target="_blank" rel="noreferrer" className="t-label opacity-70 hover:underline">
                Trello[↗]
              </a>
            )}
            {actions}
          </nav>
        </header>

        <div className="relative z-10 flex flex-1 flex-col pt-5">{children}</div>

        <footer className="t-label relative z-30 mt-6 flex items-center justify-between gap-3 border-t border-[#07162b]/15 pt-3">
          <span>Local {clock || "--:--:--"}</span>
          <span className="hidden sm:inline">{viewport || "---- x ---- Y"}</span>
          {BOARD_URL ? (
            <a href={BOARD_URL} target="_blank" rel="noreferrer" aria-label="Open Trello board" className="opacity-80 hover:opacity-100">
              <Globe />
            </a>
          ) : (
            <Globe />
          )}
        </footer>

        {stickers}
      </div>
    </div>
  );
}

function Globe() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </svg>
  );
}
