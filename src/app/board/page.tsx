"use client";

import { useCallback, useEffect, useState } from "react";
import type { BoardData } from "@/lib/types";
import { GlassWord } from "@/components/Decor";
import { Shell, BOARD_URL } from "@/components/Shell";
import { TaskCard } from "@/components/TaskCard";

type Filter = "all" | "high" | "medium" | "low";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high", label: "P1" },
  { key: "medium", label: "P2" },
  { key: "low", label: "P3" },
];

const POLL_MS = 10_000;
const pad2 = (n: number) => String(n).padStart(2, "0");

export default function BoardPage() {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/board", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not load the board.");
      setData(json);
      setError("");
      const d = new Date();
      setUpdated(`${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Live board: poll while the tab is visible so cards created by voice show up on their own.
  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const total = data?.lists.reduce((n, l) => n + l.cards.length, 0) ?? 0;
  const urgent = data?.lists.reduce((n, l) => n + l.cards.filter((c) => c.priority === "high").length, 0) ?? 0;

  return (
    <Shell
      active="board"
      actions={
        <button onClick={load} disabled={refreshing} className="t-label opacity-70 hover:underline disabled:opacity-40">
          Refresh[R]
        </button>
      }
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="t-label">{data?.name ?? "Live from Trello"}</p>
          <h1 className="t-display mt-2">The board.</h1>
          <p className="t-body mt-3 max-w-[440px]">
            Everything VoiceBoard has filed on Trello. It refreshes by itself, so cards you dictate show up here within
            seconds.
          </p>
        </div>
        <div className="hidden h-[130px] w-[330px] md:block" aria-hidden>
          <GlassWord word="board" />
        </div>
      </div>

      {/* controls */}
      <div className="mt-6 flex flex-col gap-3 border-t border-[#07162b]/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by priority">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`t-label border border-[#07162b] px-3 py-1.5 transition-colors ${
                filter === f.key ? "bg-[#07162b] text-[#eef6fd]" : "hover:bg-[#07162b]/10"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="t-label ml-1 opacity-70">
            {pad2(total)} cards{urgent > 0 ? ` — ${pad2(urgent)} urgent` : ""}
          </span>
        </div>
        <p className="t-label flex items-center gap-2 opacity-80">
          <i className={`inline-block h-2 w-2 ${error ? "bg-[#e11d48]" : "blink bg-[#1f9d55]"}`} />
          {error ? "Offline" : `Live — updated ${updated || "--:--:--"}`}
        </p>
      </div>

      {error && (
        <div className="mt-4 border border-[#c01138] p-3">
          <p className="t-label text-[#c01138]">{error}</p>
          <button onClick={load} className="t-label mt-2 underline underline-offset-4">
            Try again
          </button>
        </div>
      )}

      {/* columns */}
      <div className="mt-5 grid gap-6 md:grid-cols-3">
        {loading &&
          [0, 1, 2].map((i) => (
            <div key={i}>
              <div className="t-label blink mb-3 border-b border-[#07162b]/30 pb-2">Loading...</div>
              <div className="h-[150px] border border-dashed border-[#07162b]/60" />
            </div>
          ))}

        {data?.lists.map((list) => {
          const cards = list.cards.filter((c) => filter === "all" || c.priority === filter);
          return (
            <section key={list.id} aria-label={list.name}>
              <h2 className="t-label mb-3 flex items-center justify-between border-b border-[#07162b]/30 pb-2">
                <span>{list.name}</span>
                <span>{pad2(cards.length)}</span>
              </h2>
              {cards.length === 0 ? (
                <p className="t-label border border-dashed border-[#07162b]/40 p-4 opacity-60">Nothing here yet</p>
              ) : (
                <ul className="space-y-3">
                  {cards.map((c, i) => (
                    <TaskCard key={c.id} card={c} index={i} fluid />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {BOARD_URL && (
        <p className="t-label mt-8">
          <a href={BOARD_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            Open the full board on Trello ↗
          </a>
        </p>
      )}
    </Shell>
  );
}
