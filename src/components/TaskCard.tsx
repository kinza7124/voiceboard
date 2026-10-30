"use client";

import { useState } from "react";
import type { ListKey, Priority, Task, Ticket } from "@/lib/types";

const PRIORITY = {
  high: { label: "P1 High", color: "#ff3b30" },
  medium: { label: "P2 Med", color: "#ffb020" },
  low: { label: "P3 Low", color: "#22c55e" },
} as const;
const NO_PRIORITY = { label: "No priority", color: "#8ea3b8" };

const LIST_LABEL: Record<ListKey, string> = { todo: "To Do", doing: "Doing", done: "Done" };

function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDue(iso: string) {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
    .replace(",", "");
}

export function dueIn(iso: string) {
  const diff = Math.round(
    (new Date(`${iso}T12:00:00`).getTime() - new Date(`${todayISO()}T12:00:00`).getTime()) / 86400000
  );
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return `+${diff}d`;
}

const STRIP_WIDTH = "w-[min(78vw,260px)] shrink-0 sm:w-[236px]";

/** Ticket card. `fluid` makes it fill its container (board columns); otherwise it is a fixed-width strip item. */
export function TaskCard({ card, index, fluid = false }: { card: Ticket; index: number; fluid?: boolean }) {
  const [notes, setNotes] = useState(false);
  const [copied, setCopied] = useState(false);
  const p = card.priority ? PRIORITY[card.priority] : NO_PRIORITY;
  const list = card.list && card.list in LIST_LABEL ? LIST_LABEL[card.list as ListKey] : card.list;

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!card.url) return;
    try {
      await navigator.clipboard.writeText(card.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard can be blocked; nothing to do */
    }
  }

  return (
    <li
      onClick={() => setNotes((n) => !n)}
      className={`card-in group cursor-pointer select-none border border-[#07162b] bg-[#eef6fd]/85 p-3 backdrop-blur-[2px] transition-colors duration-150 hover:bg-[#07162b] hover:text-[#eef6fd] ${
        card.duplicate ? "border-dashed opacity-80" : ""
      } ${fluid ? "w-full" : STRIP_WIDTH}`}
      style={{ animationDelay: `${Math.min(index, 8) * 90}ms` }}
    >
      <div className="t-label flex items-center justify-between">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2 w-2" style={{ background: p.color }} />
          {p.label}
        </span>
      </div>

      <h2 className="t-title mt-2 min-h-[38px]">{card.title}</h2>

      {notes ? (
        <p className="t-body mt-2 min-h-[66px]">{card.notes || "No extra context was mentioned."}</p>
      ) : (
        <dl className="t-label mt-2 grid min-h-[66px] grid-cols-[52px_1fr] content-start gap-y-1.5">
          <dt className="opacity-50">Owner</dt>
          <dd className="truncate" title={card.assigned ? "Assigned to a Trello board member" : undefined}>
            {card.owner ?? "-"}
            {card.assigned && " ✓"}
          </dd>
          <dt className="opacity-50">Due</dt>
          <dd className="truncate">{card.due ? `${formatDue(card.due)} (${dueIn(card.due)})` : "-"}</dd>
          {list && (
            <>
              <dt className="opacity-50">List</dt>
              <dd className="truncate">{list}</dd>
            </>
          )}
        </dl>
      )}

      <div className="t-label mt-2.5 flex items-center justify-between">
        {card.duplicate ? (
          <span className="text-[#b45309] group-hover:text-[#ffb020]">Duplicate</span>
        ) : null}
        {card.url ? (
          <a
            href={card.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="underline underline-offset-4"
          >
            {card.duplicate ? "Existing ↗" : "Open ↗"}
          </a>
        ) : (
          !card.duplicate && <span title={card.error}>Failed</span>
        )}
        {!card.duplicate && card.url && (
          <button onClick={copy} className="underline-offset-4 hover:underline">
            {copied ? "Copied" : "Copy"}
          </button>
        )}
        {!card.duplicate && <span className="opacity-50">{notes ? "Back" : "Notes +"}</span>}
      </div>
    </li>
  );
}

const field =
  "t-label w-full border border-[#07162b]/40 bg-white/60 px-1.5 py-1 focus:border-[#1f5cff] focus:outline-none";

/** Editable preview of a parsed task, shown during the review window. Any interaction pauses the countdown. */
export function ReviewCard({
  task,
  index,
  onChange,
  onRemove,
  onTouch,
}: {
  task: Task;
  index: number;
  onChange: (t: Task) => void;
  onRemove: () => void;
  onTouch: () => void;
}) {
  const set = <K extends keyof Task>(k: K, v: Task[K]) => onChange({ ...task, [k]: v });

  return (
    <li
      onPointerDownCapture={onTouch}
      onFocusCapture={onTouch}
      className="card-in w-[min(82vw,280px)] shrink-0 border border-dashed border-[#07162b] bg-[#eef6fd]/85 p-3 backdrop-blur-[2px] sm:w-[252px]"
      style={{ animationDelay: `${Math.min(index, 8) * 90}ms` }}
    >
      <div className="t-label flex items-center justify-between">
        <span>{String(index + 1).padStart(2, "0")} — Edit</span>
        <button onClick={onRemove} aria-label={`Remove task ${index + 1}`} className="hover:underline">
          Remove ×
        </button>
      </div>

      <textarea
        value={task.title}
        onChange={(e) => set("title", e.target.value)}
        aria-label="Task title"
        rows={2}
        className="t-title mt-2 w-full resize-none border-b border-[#07162b]/40 bg-transparent focus:border-[#1f5cff] focus:outline-none"
      />

      <div className="t-label mt-2 grid grid-cols-[52px_1fr] items-center gap-x-2 gap-y-1.5">
        <span className="opacity-50">Owner</span>
        <input
          value={task.owner ?? ""}
          onChange={(e) => set("owner", e.target.value || null)}
          aria-label="Owner"
          placeholder="-"
          className={field}
        />
        <span className="opacity-50">Due</span>
        <input
          type="date"
          value={task.due ?? ""}
          onChange={(e) => set("due", e.target.value || null)}
          aria-label="Due date"
          className={field}
        />
        <span className="opacity-50">Prio</span>
        <select
          value={task.priority}
          onChange={(e) => set("priority", e.target.value as Priority)}
          aria-label="Priority"
          className={field}
        >
          <option value="high">P1 High</option>
          <option value="medium">P2 Med</option>
          <option value="low">P3 Low</option>
        </select>
        <span className="opacity-50">List</span>
        <select
          value={task.list}
          onChange={(e) => set("list", e.target.value as ListKey)}
          aria-label="Trello list"
          className={field}
        >
          <option value="todo">To Do</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </select>
      </div>
    </li>
  );
}

export function SummaryBlock({ summary, decisions }: { summary: string; decisions: string[] }) {
  if (!summary && decisions.length === 0) return null;
  return (
    <div className="mb-3 border-l-2 border-[#07162b] pl-3">
      {summary && (
        <p className="t-body">
          <span className="t-label mr-2 opacity-60">Summary</span>
          {summary}
        </p>
      )}
      {decisions.length > 0 && <p className="t-label mt-1.5 opacity-80">Decisions — {decisions.join(" · ")}</p>}
    </div>
  );
}

export function PlaceholderCard({ index, fluid = false }: { index: number; fluid?: boolean }) {
  return (
    <li
      className={`border border-dashed border-[#07162b]/70 p-3 ${fluid ? "w-full" : STRIP_WIDTH}`}
      style={{ opacity: 1 - index * 0.15 }}
    >
      <div className="t-label blink">Sorting...</div>
      <div className="mt-3 h-4 w-4/5 bg-[#07162b]/15" />
      <div className="mt-2 h-4 w-3/5 bg-[#07162b]/15" />
      <div className="mt-6 h-3 w-2/5 bg-[#07162b]/10" />
    </li>
  );
}
