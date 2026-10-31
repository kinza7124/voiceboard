import type { ListKey, Priority, Task } from "./types";

const LISTS: ListKey[] = ["todo", "doing", "done"];
const PRIORITIES: Priority[] = ["high", "medium", "low"];

/** Coerces untrusted input (model output or a client request) into a valid Task, or null. */
export function sanitizeTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const title = String(t.title ?? "").trim().slice(0, 120);
  if (!title) return null;
  const owner = t.owner ? String(t.owner).trim().slice(0, 40) : "";
  const due = typeof t.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : null;
  return {
    title,
    owner: owner || null,
    due,
    priority: PRIORITIES.includes(t.priority as Priority) ? (t.priority as Priority) : "medium",
    notes: String(t.notes ?? "").trim().slice(0, 300),
    list: LISTS.includes((t.list ?? t.status) as ListKey) ? ((t.list ?? t.status) as ListKey) : "todo",
  };
}

const LIST_WORDS: Record<string, ListKey> = {
  "to do": "todo",
  todo: "todo",
  doing: "doing",
  "in progress": "doing",
  done: "done",
};

/** "Move the pricing deck to Done" -> { query: "pricing deck", list: "done" }; null if it is not a move command. */
export function parseMoveCommand(text: string): { query: string; list: ListKey } | null {
  const m = /^\s*(?:please\s+)?(?:move|put|send)\s+(?:the\s+)?(.+?)\s+(?:card\s+)?(?:to|into)\s+(?:the\s+)?(to\s*do|todo|doing|in\s+progress|done)(?:\s+(?:list|column))?\W*\s*$/i.exec(
    text
  );
  if (!m) return null;
  const query = m[1].replace(/\s+card$/i, "").trim();
  const list = LIST_WORDS[m[2].toLowerCase().replace(/\s+/g, " ")];
  return query && list ? { query, list } : null;
}

/** True when the whole dictation is just an undo command. */
export function isUndoCommand(text: string): boolean {
  return /^\s*(please\s+)?(undo(\s+(that|those|it|all|the\s+last\s+(one|batch)))?|delete\s+(those|that|them|it)|remove\s+(those|that|them)|scratch\s+that)\W*\s*$/i.test(
    text
  );
}
