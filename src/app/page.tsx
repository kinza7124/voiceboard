"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CreatedCard, Task } from "@/lib/types";
import { isUndoCommand, parseMoveCommand } from "@/lib/tasks";
import { BlueCursor, Draggable, GlassWord, GreenSticker, PinkSticker } from "@/components/Decor";
import { Shell } from "@/components/Shell";
import { PlaceholderCard, ReviewCard, SummaryBlock, TaskCard } from "@/components/TaskCard";

type Status = "idle" | "typing" | "processing" | "review" | "done" | "error";
type Batch = { id: number; cards: CreatedCard[]; summary: string; decisions: string[] };
type Review = { tasks: Task[]; summary: string; decisions: string[]; transcript: string };

const IDLE_MS = 2500;
const MIN_CHARS = 15;
const REVIEW_CHOICES = [3, 6, 0]; // seconds of review window; 0 creates immediately
const STORAGE_KEY = "voiceboard-review-secs";

const WORDS: Record<Status, string> = {
  idle: "speak",
  typing: "go on",
  processing: "sorting",
  review: "check",
  done: "done",
  error: "oops",
};

const DOT: Record<Status, string> = {
  idle: "#1f9d55",
  typing: "#e8a200",
  processing: "#2563ff",
  review: "#e8a200",
  done: "#1f9d55",
  error: "#e11d48",
};

function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Meeting notes as Markdown, ready to paste into Slack, email or a doc. */
function toMarkdown(batch: Batch): string {
  const owner = (c: CreatedCard) => (c.owner ? ` (${c.owner})` : "");
  const due = (c: CreatedCard) => (c.due ? `, due ${c.due}` : "");
  const lines = [batch.summary ? `**Summary:** ${batch.summary}` : "", ""];
  if (batch.decisions.length) lines.push("**Decisions**", ...batch.decisions.map((d) => `- ${d}`), "");
  lines.push(
    "**Tasks**",
    ...batch.cards
      .filter((c) => !c.duplicate)
      .map((c) => `- [${c.list === "done" ? "x" : " "}] ${c.title}${owner(c)}${due(c)} · ${c.priority} priority`)
  );
  return lines.join("\n").trim();
}
const par =(x: number, y: number) => ({
  transform: `translate(calc(var(--px, 0) * ${x}px), calc(var(--py, 0) * ${y}px))`,
});
const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function Home() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reviewSecs, setReviewSecs] = useState(3);
  const [counts, setCounts] = useState({ made: 0, dups: 0 });
  const [copiedMd, setCopiedMd] = useState(false);

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef(false);
  const textRef = useRef("");
  const batchId = useRef(0);
  const reviewRef = useRef<Review | null>(null);
  const reviewSecsRef = useRef(3);
  const batchesRef = useRef<Batch[]>([]);
  const totalRef = useRef(3000);
  batchesRef.current = batches;
  reviewRef.current = review;

  const focusArea = () => areaRef.current?.focus({ preventScroll: true });

  useEffect(() => {
    focusArea();
    try {
      // getItem returns null when nothing is saved; Number(null) would be 0 (review off), so check first.
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null && REVIEW_CHOICES.includes(Number(raw))) {
        setReviewSecs(Number(raw));
        reviewSecsRef.current = Number(raw);
      }
    } catch {
      /* storage unavailable; keep the default */
    }
  }, []);

  function cycleReview() {
    const next = REVIEW_CHOICES[(REVIEW_CHOICES.indexOf(reviewSecs) + 1) % REVIEW_CHOICES.length];
    setReviewSecs(next);
    reviewSecsRef.current = next;
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  }

  const clearText = () => {
    textRef.current = "";
    setText("");
  };

  const finishBatch = useCallback((cards: CreatedCard[], summary: string, decisions: string[]) => {
    const made = cards.filter((c) => c.url && !c.duplicate).length;
    const dups = cards.filter((c) => c.duplicate).length;
    batchId.current += 1;
    setBatches((prev) => [{ id: batchId.current, cards, summary, decisions }, ...prev]);
    setCounts({ made, dups });
    setStatus("done");
    setMessage("");
    textRef.current = "";
    setText("");
  }, []);

  /** Voice command: archive the cards from the most recent batch. */
  const undoLast = useCallback(async () => {
    if (processingRef.current) return;
    const last = batchesRef.current[0];
    const ids = (last?.cards ?? []).filter((c) => c.id && c.url && !c.duplicate).map((c) => c.id as string);
    textRef.current = "";
    setText("");
    if (!last || ids.length === 0) {
      setStatus("done");
      setMessage("Nothing to undo.");
      return;
    }
    processingRef.current = true;
    setStatus("processing");
    try {
      const res = await post("/api/undo", { ids });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Undo failed.");
      setBatches((prev) => prev.slice(1));
      setStatus("done");
      setMessage(`Undone. Archived ${data.archived} card${data.archived === 1 ? "" : "s"} on Trello.`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Couldn't undo. Try again.");
    } finally {
      processingRef.current = false;
      focusArea();
    }
  }, []);

  /** Voice command: "move the pricing deck to Done". */
  const moveByVoice = useCallback(async (cmd: { query: string; list: string }) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setStatus("processing");
    setMessage("");
    try {
      const res = await post("/api/move", cmd);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Move failed.");
      if (data.moved) {
        const name = ({ todo: "To Do", doing: "Doing", done: "Done" } as Record<string, string>)[data.list];
        setStatus("done");
        setMessage(`Moved "${data.title}" to ${name}.`);
        textRef.current = "";
        setText("");
      } else {
        setStatus("error");
        setMessage(data.reason || "Couldn't move that card.");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Couldn't move that card.");
    } finally {
      processingRef.current = false;
      focusArea();
    }
  }, []);

  /** Writes the reviewed (possibly edited) tasks to Trello. */
  const createFromReview = useCallback(async () => {
    const r = reviewRef.current;
    if (!r || processingRef.current) return;
    processingRef.current = true;
    setStatus("processing");
    setMessage("");
    try {
      const res = await post("/api/create", { tasks: r.tasks });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Your tasks are still here.");
        setPaused(true);
        return;
      }
      finishBatch(data.cards ?? [], r.summary, r.decisions);
      reviewRef.current = null;
      setReview(null);
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Your tasks are still here, press Create cards now to retry.");
      setPaused(true);
    } finally {
      processingRef.current = false;
      focusArea();
    }
  }, [finishBatch]);

  const cancelReview = useCallback(() => {
    const r = reviewRef.current;
    reviewRef.current = null;
    setReview(null);
    if (r) {
      textRef.current = r.transcript;
      setText(r.transcript);
    }
    setStatus("idle");
    setMessage("");
    focusArea();
  }, []);

  // Review window: count down, and create when it hits zero unless the user touched something.
  useEffect(() => {
    if (status !== "review" || paused) return;
    const t = setInterval(() => setRemaining((r) => r - 100), 100);
    return () => clearInterval(t);
  }, [status, paused]);

  useEffect(() => {
    if (status === "review" && !paused && remaining <= 0) createFromReview();
  }, [status, paused, remaining, createFromReview]);

  const submit = useCallback(async () => {
    const transcript = textRef.current.trim();
    if (processingRef.current) return;
    if (!transcript) {
      setStatus("error");
      setMessage("Nothing to process, the text is empty.");
      return;
    }
    if (isUndoCommand(transcript)) {
      undoLast();
      return;
    }
    const move = parseMoveCommand(transcript);
    if (move) {
      moveByVoice(move);
      return;
    }
    const preview = reviewSecsRef.current > 0;
    processingRef.current = true;
    setStatus("processing");
    setMessage("");

    try {
      const res = await post("/api/process", { transcript, today: todayISO(), preview });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Your text is still here.");
        return;
      }
      const summary: string = data.summary ?? "";
      const decisions: string[] = data.decisions ?? [];

      if (preview) {
        const tasks: Task[] = data.tasks ?? [];
        if (!tasks.length) {
          setStatus("done");
          setMessage("No tasks found in that.");
          return;
        }
        totalRef.current = reviewSecsRef.current * 1000;
        setRemaining(totalRef.current);
        setPaused(false);
        setReview({ tasks, summary, decisions, transcript });
        setStatus("review");
        clearText();
        return;
      }

      const cards: CreatedCard[] = data.cards ?? [];
      if (!cards.length) {
        setStatus("done");
        setMessage("No tasks found in that.");
        return;
      }
      finishBatch(cards, summary, decisions);
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Your text is still here, press Create cards now to retry.");
    } finally {
      processingRef.current = false;
      focusArea();
    }
  }, [finishBatch, undoLast, moveByVoice]);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);
    textRef.current = value;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value.trim()) {
      if (!reviewRef.current) {
        setStatus("idle");
        setMessage("");
      }
      return;
    }
    if (!processingRef.current && !reviewRef.current) setStatus("typing");
    timerRef.current = setTimeout(() => {
      const t = textRef.current.trim();
      if (processingRef.current || reviewRef.current) return;
      if (isUndoCommand(t) || parseMoveCommand(t) || t.length >= MIN_CHARS) submit();
    }, IDLE_MS);
  }

  // Keyboard: Esc cancels a review, Ctrl/Cmd+Enter creates now.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && reviewRef.current) cancelReview();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (timerRef.current) clearTimeout(timerRef.current);
        if (reviewRef.current) createFromReview();
        else submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelReview, createFromReview, submit]);

  function onCreateClick() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (reviewRef.current) createFromReview();
    else submit();
  }

  function statusText() {
    if (status === "error") return message;
    if (status === "processing") return "Turning your ramble into tasks...";
    if (status === "review") {
      return paused
        ? "Editing. Press Create cards now when ready."
        : `Creating in ${Math.max(1, Math.ceil(remaining / 1000))}s. Touch any field to edit.`;
    }
    if (status === "done") {
      if (message) return message;
      const { made, dups } = counts;
      if (made === 0 && dups > 0) return `Nothing new: ${dups === 1 ? "that is" : "those are"} already on the board.`;
      return `Created ${made} card${made === 1 ? "" : "s"} on Trello.${dups ? ` Skipped ${dups} duplicate${dups === 1 ? "" : "s"}.` : ""}`;
    }
    if (status === "typing") return "Keep going, I'll submit when you pause.";
    return "Listening for your dictation...";
  }

  const allCards = batches.flatMap((b) => b.cards);
  const processing = status === "processing";
  const reviewing = status === "review" || (review !== null && status === "error");
  const showStrip = allCards.length > 0 || processing || reviewing;
  const urgent = allCards.filter((c) => c.priority === "high" && !c.duplicate).length;
  const latest = batches[0];

  const updateTask = (i: number, t: Task) =>
    setReview((r) => (r ? { ...r, tasks: r.tasks.map((x, j) => (j === i ? t : x)) } : r));
  const removeTask = (i: number) => {
    if (!review) return;
    if (review.tasks.length === 1) cancelReview();
    else setReview({ ...review, tasks: review.tasks.filter((_, j) => j !== i) });
  };

  const stickers = (
    <>
      <div className="pointer-events-none absolute -bottom-9 left-[34%] z-0 hidden h-20 w-24 rounded-full bg-gradient-to-br from-[#ff5a4d] to-[#ff2d8f] md:block" style={par(10, 4)} />
      <Draggable
        className={`absolute z-40 hidden -rotate-6 transition-[left,top] duration-700 ease-out lg:block ${
          showStrip ? "left-[40%] top-[-14px]" : "left-[16%] top-[74px]"
        }`}
      >
        <div className={`bob origin-center transition-transform duration-700 ${showStrip ? "scale-50" : "scale-90"}`} style={{ animationDelay: "0.4s" }}>
          <GreenSticker />
        </div>
      </Draggable>
      <Draggable
        className={`absolute z-40 hidden rotate-3 transition-[left,top] duration-700 ease-out lg:block ${
          showStrip ? "left-[47%] top-[calc(100%-290px)]" : "left-[72%] top-[210px]"
        }`}
      >
        <div className="bob" style={{ animationDelay: "1.2s" }}>
          <PinkSticker />
        </div>
      </Draggable>
      <Draggable className="absolute right-[3%] top-[215px] z-40 hidden lg:block">
        <div className="bob" style={{ ...par(-16, -10), animationDelay: "2s" }}>
          <BlueCursor />
        </div>
      </Draggable>
    </>
  );

  return (
    <Shell
      active="home"
      stickers={stickers}
      actions={
        <>
          <button
            onClick={cycleReview}
            title="Seconds you get to review and edit tasks before they are created"
            className="t-label opacity-70 hover:underline"
          >
            Review[{reviewSecs ? `${reviewSecs}S` : "OFF"}]
          </button>
          <button
            onClick={() => {
              setBatches([]);
              setCounts({ made: 0, dups: 0 });
              setStatus("idle");
              setMessage("");
              focusArea();
            }}
            className="t-label opacity-70 hover:underline"
          >
            Clear[X]
          </button>
        </>
      }
    >
      {/* intro */}
      <div className="grid gap-3 md:grid-cols-3 md:gap-6">
        <p className="t-title">
          Voice-first
          <br />
          task capture
        </p>
        <p className="t-body hidden md:block">
          Talk like a human.
          <br />
          Cards like a PM.
        </p>
        <p className="t-body">
          Dictate a messy meeting brain-dump with Wispr Flow. VoiceBoard splits it into owners, deadlines and
          priorities, then files real cards on Trello. No keyboard. No form.
        </p>
      </div>

      {/* centrepiece: the glass word, or the ticket strip once there is something to show */}
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] content-center py-4 [&>*]:col-start-1 [&>*]:row-start-1">
        <div
          className={`h-[170px] transition-all duration-700 sm:h-[210px] ${showStrip ? "scale-95 opacity-[0.14] blur-[3px]" : "opacity-100"}`}
          style={par(-14, -8)}
        >
          <GlassWord word={WORDS[status]} />
        </div>

        {showStrip && (
          <div className="z-20 self-center">
            {/* header row */}
            {reviewing && !processing ? (
              <div className="mb-2">
                <div className="t-label flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <span>
                    Review — {pad2(review?.tasks.length ?? 0)} tasks —{" "}
                    {paused ? "editing" : `creating in ${Math.max(1, Math.ceil(remaining / 1000))}s`}
                  </span>
                  <span className="flex gap-4">
                    <button onClick={onCreateClick} className="underline underline-offset-4">
                      Create now ↵
                    </button>
                    <button onClick={cancelReview} className="hover:underline">
                      Cancel
                    </button>
                  </span>
                </div>
                <div className="mt-1.5 h-[2px] bg-[#07162b]/15">
                  <div
                    className="h-full bg-[#07162b] transition-[width] duration-100 ease-linear"
                    style={{ width: paused ? "100%" : `${Math.max(0, Math.min(100, (remaining / totalRef.current) * 100))}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="t-label mb-2 flex items-center justify-between gap-3">
                <span>
                  {processing
                    ? "Sorting..."
                    : `To do — ${pad2(allCards.filter((c) => !c.duplicate).length)} cards${urgent > 0 ? ` — ${pad2(urgent)} urgent` : ""}`}
                </span>
                {!processing && (
                  <span className="flex shrink-0 gap-4">
                    {latest && (
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(toMarkdown(latest));
                            setCopiedMd(true);
                            setTimeout(() => setCopiedMd(false), 1400);
                          } catch {
                            /* clipboard can be blocked; nothing to do */
                          }
                        }}
                        className="hover:underline"
                        title="Copy the summary, decisions and tasks as Markdown"
                      >
                        {copiedMd ? "Copied ✓" : "Copy notes (MD)"}
                      </button>
                    )}
                    {batches.length > 0 && (
                      <button onClick={undoLast} className="hover:underline" title='Or just say "undo"'>
                        Undo last ↺
                      </button>
                    )}
                    <Link href="/board" className="hover:underline">
                      Open board →
                    </Link>
                  </span>
                )}
              </div>
            )}

            {/* summary + decisions from the dictation */}
            {!processing && <SummaryBlock summary={reviewing ? review?.summary ?? "" : latest?.summary ?? ""} decisions={reviewing ? review?.decisions ?? [] : latest?.decisions ?? []} />}

            {/* cards */}
            <div className="strip overflow-x-auto pb-3">
              <ul className="flex w-max items-start gap-3">
                {processing && [0, 1, 2, 3].map((i) => <PlaceholderCard key={`ph${i}`} index={i} />)}
                {!processing &&
                  reviewing &&
                  review?.tasks.map((t, i) => (
                    <ReviewCard
                      key={i}
                      task={t}
                      index={i}
                      onChange={(nt) => updateTask(i, nt)}
                      onRemove={() => removeTask(i)}
                      onTouch={() => setPaused(true)}
                    />
                  ))}
                {!processing && !reviewing && batches.map((b) => b.cards.map((c, i) => <TaskCard key={`${b.id}-${i}`} card={c} index={i} />))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* headline + input */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-8">
        <h1 className="t-display">
          You talk.
          <br />
          It sorts.
          <br />
          Trello fills.
        </h1>

        <div className="w-full md:w-[42%] md:max-w-[500px]">
          <div className="t-label mb-1.5 flex justify-between">
            <span>Input / Voice</span>
            <span>{String(text.length).padStart(3, "0")} ch</span>
          </div>
          <textarea
            ref={areaRef}
            value={text}
            onChange={onChange}
            placeholder="Hold your Wispr Flow key and talk. Stop talking and I'll create the cards."
            className="t-input h-[150px] w-full resize-none border border-[#07162b] bg-white/45 p-3 text-[#07162b] caret-[#1f5cff] backdrop-blur-sm placeholder:text-[#07162b]/45 focus:bg-white/70 focus:outline-none md:h-[132px]"
          />
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p
              className={`t-label flex min-h-[32px] items-start gap-2 ${status === "error" ? "text-[#c01138]" : ""}`}
              aria-live="polite"
            >
              <i
                className={`mt-[3px] inline-block h-2 w-2 shrink-0 ${status === "idle" || status === "processing" ? "blink" : ""}`}
                style={{ background: DOT[status] }}
              />
              <span>{statusText()}</span>
            </p>
            <button
              onClick={onCreateClick}
              disabled={processing}
              className="t-label shrink-0 border border-[#07162b] px-4 py-2.5 transition-colors hover:bg-[#07162b] hover:text-[#eef6fd] disabled:opacity-40"
            >
              Create cards now ↵
            </button>
          </div>
          <p className="t-label mt-1 opacity-60">
            Say &quot;undo&quot; or &quot;move the pricing deck to done&quot; · Ctrl+Enter creates · Esc cancels
          </p>
        </div>
      </div>
    </Shell>
  );
}
