import type { BoardData, CreatedCard, ListKey, Priority, Task } from "./types";

const API = "https://api.trello.com/1";
const CACHE_MS = 60_000;

type Member = { id: string; fullName: string; username: string };
type BoardInfo = {
  at: number;
  lists: Record<ListKey, string>;
  members: Member[];
  meId: string | null;
  labels: Record<Priority, string>;
};

const LABELS: Record<Priority, { name: string; color: string }> = {
  high: { name: "P1 High", color: "red" },
  medium: { name: "P2 Medium", color: "yellow" },
  low: { name: "P3 Low", color: "green" },
};

let cache: BoardInfo | null = null;

function auth() {
  const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID } = process.env;
  if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_BOARD_ID) {
    throw new Error("Trello is not configured. Check TRELLO_KEY, TRELLO_TOKEN and TRELLO_BOARD_ID.");
  }
  return `key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
}

async function trello<T>(method: "GET" | "POST" | "PUT", path: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API}${path}?${query ? `${query}&` : ""}${auth()}`, { method, cache: "no-store" });
  if (!res.ok) throw new Error(`Trello ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

const boardId = () => process.env.TRELLO_BOARD_ID as string;

async function getBoardInfo(): Promise<BoardInfo> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;

  const [lists, members, me, labels] = await Promise.all([
    trello<{ id: string; name: string }[]>("GET", `/boards/${boardId()}/lists`),
    trello<Member[]>("GET", `/boards/${boardId()}/members`),
    trello<{ id: string }>("GET", "/members/me", { fields: "id" }).catch(() => null),
    trello<{ id: string; name: string }[]>("GET", `/boards/${boardId()}/labels`, { fields: "name", limit: "1000" }),
  ]);
  if (!lists.length) throw new Error("The Trello board has no lists.");

  // Match lists by name; anything missing falls back to To Do (or the first list).
  const find = (re: RegExp) => lists.find((l) => re.test(l.name.trim()))?.id;
  const todo = find(/^to\s*-?\s*do$/i) ?? lists[0].id;
  const listIds: Record<ListKey, string> = {
    todo,
    doing: find(/^(doing|in progress)$/i) ?? todo,
    done: find(/^done$/i) ?? todo,
  };

  // Reuse the priority labels if they exist, otherwise create them once.
  const labelIds = {} as Record<Priority, string>;
  for (const p of Object.keys(LABELS) as Priority[]) {
    const wanted = LABELS[p];
    const existing = labels.find((l) => l.name.toLowerCase() === wanted.name.toLowerCase());
    labelIds[p] = existing
      ? existing.id
      : (await trello<{ id: string }>("POST", `/boards/${boardId()}/labels`, { name: wanted.name, color: wanted.color })).id;
  }

  cache = { at: Date.now(), lists: listIds, members, meId: me?.id ?? null, labels: labelIds };
  return cache;
}

/** Owner as spoken ("Sara", "Me") to a real board member, if there is one. */
function matchMember(owner: string | null, info: BoardInfo): Member | undefined {
  if (!owner) return undefined;
  const who = owner.trim().toLowerCase();
  if (who === "me" || who === "myself") return info.members.find((m) => m.id === info.meId);
  const first = (m: Member) => m.fullName.trim().toLowerCase().split(/\s+/)[0];
  return (
    info.members.find((m) => m.fullName.toLowerCase() === who || m.username.toLowerCase() === who) ??
    info.members.find((m) => first(m) === who) ??
    (who.length >= 3 ? info.members.find((m) => first(m).startsWith(who)) : undefined)
  );
}

/* ---------- duplicate guard ---------- */

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/^[\u{1F534}\u{1F7E1}\u{1F7E2}]\s*/u, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

function similar(a: string, b: string) {
  if (a === b) return true;
  const A = new Set(a.split(" "));
  const B = new Set(b.split(" "));
  if (A.size < 2 || B.size < 2) return false;
  let shared = 0;
  A.forEach((w) => B.has(w) && shared++);
  return shared / (A.size + B.size - shared) >= 0.7;
}

/* ---------- creating, archiving, reading ---------- */

async function createCard(task: Task, info: BoardInfo): Promise<CreatedCard> {
  try {
    const member = matchMember(task.owner, info);
    const params: Record<string, string> = {
      idList: info.lists[task.list],
      name: task.title,
      desc: `Owner: ${task.owner ?? "Unassigned"}\n\n${task.notes}\n\n_Created by VoiceBoard from voice dictation._`,
      idLabels: info.labels[task.priority],
      pos: "bottom",
    };
    if (task.due) params.due = `${task.due}T17:00:00.000Z`;
    if (member) params.idMembers = member.id;

    const card = await trello<{ id: string; shortUrl: string }>("POST", "/cards", params);
    console.log("[trello card]", card.shortUrl);
    return { ...task, id: card.id, url: card.shortUrl, assigned: Boolean(member) };
  } catch (err) {
    return { ...task, error: err instanceof Error ? err.message : "Failed to create card" };
  }
}

export async function createCards(tasks: Task[]): Promise<CreatedCard[]> {
  const info = await getBoardInfo();
  const open = await trello<{ name: string; shortUrl: string }[]>("GET", `/boards/${boardId()}/cards`, {
    fields: "name,shortUrl",
  });
  const known = open.map((c) => ({ key: normalise(c.name), url: c.shortUrl }));

  // Decide up front which tasks are duplicates (of the board or of each other), then create the rest in parallel.
  const seen: string[] = [];
  const plan = tasks.map((task) => {
    const key = normalise(task.title);
    const dup = known.find((k) => similar(k.key, key));
    const repeat = seen.some((s) => similar(s, key));
    seen.push(key);
    return { task, dup, repeat };
  });

  return Promise.all(
    plan.map(({ task, dup, repeat }) =>
      dup || repeat
        ? Promise.resolve<CreatedCard>({ ...task, duplicate: true, url: dup?.url })
        : createCard(task, info)
    )
  );
}

export async function archiveCards(ids: string[]): Promise<number> {
  const results = await Promise.allSettled(ids.map((id) => trello("PUT", `/cards/${id}`, { closed: "true" })));
  return results.filter((r) => r.status === "fulfilled").length;
}

const PRIORITY_BY_EMOJI: Record<string, Priority> = { "\u{1F534}": "high", "\u{1F7E1}": "medium", "\u{1F7E2}": "low" };

/** Reads the board back and undoes the formatting createCard() applies to name, labels and desc. */
export async function getBoard(): Promise<BoardData> {
  const [info, lists] = await Promise.all([
    trello<{ name: string; shortUrl: string }>("GET", `/boards/${boardId()}`, { fields: "name,shortUrl" }),
    trello<
      {
        id: string;
        name: string;
        cards: { id: string; name: string; desc: string; due: string | null; shortUrl: string; labels: { name: string }[] }[];
      }[]
    >("GET", `/boards/${boardId()}/lists`, {
      cards: "open",
      card_fields: "name,desc,due,shortUrl,labels",
      fields: "name",
    }),
  ]);

  return {
    name: info.name,
    url: info.shortUrl,
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      cards: l.cards.map((c) => {
        const emoji = [...c.name][0];
        const labelled = c.labels
          .map((x) => /^P([123])\b/i.exec(x.name)?.[1])
          .find(Boolean);
        const priority: Priority | null = labelled
          ? (["high", "medium", "low"] as const)[Number(labelled) - 1]
          : PRIORITY_BY_EMOJI[emoji] ?? null;
        const ownerLine = /^Owner:\s*(.*)$/m.exec(c.desc)?.[1]?.trim();
        const notes = c.desc
          .replace(/^Owner:.*$/m, "")
          .replace(/_Created by VoiceBoard from voice dictation\._/, "")
          .trim();
        return {
          id: c.id,
          title: (PRIORITY_BY_EMOJI[emoji] ? c.name.replace(emoji, "") : c.name).trim(),
          owner: ownerLine && ownerLine !== "Unassigned" ? ownerLine : null,
          due: c.due ? c.due.slice(0, 10) : null,
          priority,
          notes,
          url: c.shortUrl,
        };
      }),
    })),
  };
}
