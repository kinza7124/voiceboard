# VoiceBoard

**Talk. Cards appear.** Dictate a messy meeting brain-dump with [Wispr Flow](https://wisprflow.ai) and VoiceBoard turns it into real, structured Trello cards: title, owner, due date, priority, list and notes. No keyboard, no form.

Built for the Wispr Flow hackathon. Wispr Flow is the only input method: it types into the focused field, and VoiceBoard takes it from there.

**Launch video:** [`media/brag.mp4`](media/brag.mp4) (25 s, with a [poster frame](media/brag.jpg)). The dictation in the video is an animated depiction, not a recording.

---

## Table of contents

1. [Features](#features)
2. [How it works](#how-it-works)
3. [Setup](#setup)
4. [Pages and API](#pages-and-api)
5. [Project structure](#project-structure)
6. [Demo script](#demo-script)
7. [Known limits](#known-limits)
8. [Ideas to add product value](#ideas-to-add-product-value)

---

## Features

### Capture
- **Hands-free flow.** Dictate into the field, pause for 2.5 s, and the app submits itself. There is also a "Create cards now" button as a fallback.
- **Multiple tasks from one ramble.** Compound sentences are split into separate action items; chit-chat and filler words are ignored.
- **Smart dates.** "Friday", "end of next week" and "in two weeks" are resolved against today's date using a literal 14-day calendar sent to the model, so results are the same on every run (including when today is itself a Friday).
- **Self-corrections.** "Actually make that Thursday" uses the corrected value.
- **Urgency detection.** Words like urgent, ASAP and blocking give High priority; "no rush" gives Low.
- **Summary and decisions.** Each dictation gets a one-line summary plus any decisions that were stated (not action items).

### Control
- **Review window.** Parsed tasks appear as editable cards with a countdown (default 3 s). Do nothing and they are created; touch any field to pause and edit title, owner, due date, priority or list, remove a task, then press Create now. `Review[3S]` in the header cycles 3 s / 6 s / off, and the choice is remembered.
- **Voice undo.** Say "undo", "delete those", "remove that" or "scratch that" (or press Undo last) to archive the most recent batch. Cards are archived, never deleted, so it is reversible in Trello.
- **Move cards by voice.** Say "move the pricing deck to Done" (or "put ... into doing" / "in progress"). The best-matching open card is moved; ambiguous or unmatched descriptions are refused with a clear message instead of guessing.
- **Passcode gate.** Set `APP_PASSCODE` and every page and API route requires sign-in (`/login`, 7-day cookie), so a public demo cannot be used to write to your board. Unset locally.
- **Copy notes as Markdown.** One click copies the latest summary, decisions and task checklist for Slack, email or docs.
- **Production-ready timeouts.** The API routes set `maxDuration` (60 s for extraction) so a slow model call does not hit Vercel's short default limit.
- **Keyboard shortcuts.** Ctrl/Cmd+Enter creates now; Esc cancels a review.
- **Duplicate guard.** A task similar to an existing open card (or to another task in the same batch) is skipped and linked to the existing card instead.

### Trello integration
- **Real cards** on a real board, created in parallel for speed, with a per-card result so one failure never blocks the others.
- **Smart list routing.** "Already in progress" goes to Doing, "already done" to Done, everything else to To Do.
- **Real assignees.** Owners are matched to Trello board members by full name, username or first name; "I" / "me" maps to the account that owns the token. A tick next to the owner shows a real assignment.
- **Priority labels.** `P1 High` (red), `P2 Medium` (yellow) and `P3 Low` (green) are created on the board on first use and attached to cards.
- **Due dates** are set on the card (17:00 UTC on the due day).
- **Owner and notes** are written into the description.

### Interface
- **Live board page** (`/board`): To Do / Doing / Done columns, filterable by priority, refreshed every 10 s so cards you dictate show up on their own.
- **Ticket cards** with priority, owner, due date with relative days ("+7d"), list, Open and Copy-link actions, and a Notes flip.
- **Editorial design** inspired by a design-engineer portfolio: holographic backdrop, hairline grid, glass script word that reflects the app state (speak / go on / sorting / check / done), draggable stickers.
- **Responsive** from phone to desktop, with one type scale used everywhere (`.t-display`, `.t-title`, `.t-body`, `.t-input`, `.t-label` in `src/app/globals.css`).
- **Honest status line** for every state, including errors. On any error your text and tasks are kept so nothing is lost.

### Safety
- All API keys and tokens stay server-side; the browser only talks to the app's own routes.
- Inputs are validated: empty or over-5,000-character transcripts are rejected, task payloads are sanitised, and card ids must be 24-character hex before anything is archived.

---

## How it works

```
Browser (page.tsx)
  textarea --(2.5 s idle)--> POST /api/process { transcript, today, preview }
                                   |
                                   |-- Gemini: transcript -> { summary, decisions, tasks[] }
                                   v
                         review window (editable, 3 s countdown)
                                   |
                                   v
                         POST /api/create { tasks }
                                   |-- cache: lists, members, labels (60 s)
                                   |-- duplicate check against open cards
                                   |-- POST /cards in parallel (list, labels, member, due)
                                   v
                         cards with ids + urls  ->  UI strip   /board polls GET /api/board
                                   "undo" -> POST /api/undo { ids } -> archive
```

With the review window off, `/api/process` extracts and creates in one call.

---

## Setup

You need Node 18+, a free Gemini API key and a Trello account.

1. `npm install`
2. `copy .env.example .env.local` (macOS/Linux: `cp .env.example .env.local`)
3. Add a free Gemini API key (<https://aistudio.google.com/apikey>) as `GEMINI_API_KEY`. Use a key from a project that has free-tier access.
4. Go to <https://trello.com/power-ups/admin>, create an app and copy its **API key** into `TRELLO_KEY`.
5. Generate a token with read and write access (the **Token** link on the app's API key page) and copy it into `TRELLO_TOKEN`.
6. Create a Trello board with lists **To Do**, **Doing** and **Done**.
7. Put the board id in `TRELLO_BOARD_ID` (the short id from the board URL works too).
8. `npm run dev` and open <http://localhost:3000>.

For a demo, `npm run build && npm start` avoids the slow first compile of dev mode.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Model access for extraction |
| `GEMINI_MODEL` | Optional, defaults to `gemini-3.1-flash-lite` (fast; larger models can be slow on the free tier) |
| `TRELLO_KEY`, `TRELLO_TOKEN` | Trello REST credentials |
| `TRELLO_BOARD_ID` | The board cards are written to |
| `APP_PASSCODE` | Optional. When set, the whole app is behind a passcode (use this in production) |
| `NEXT_PUBLIC_TRELLO_BOARD_ID` | Optional. Enables the Trello links in the header |

`.env.local` is git-ignored. Trello tokens can be set to expire; regenerate yours if calls start returning 401.

---

## Pages and API

| Route | What it does |
| --- | --- |
| `/` | Dictate, review, create, undo |
| `/board` | Live Trello board view |
| `POST /api/process` | `{ transcript, today, preview? }`. With `preview: true` returns `{ summary, decisions, tasks }` and writes nothing; otherwise extracts and creates, returning `{ summary, decisions, cards }` |
| `POST /api/create` | `{ tasks }` creates reviewed tasks, returns `{ cards }` (each card has `id`, `url`, `assigned`, or `duplicate` / `error`) |
| `POST /api/move` | `{ query, list }` moves the best-matching open card to `todo` / `doing` / `done` |
| `POST /api/login` | `{ passcode }` sets the auth cookie (only when `APP_PASSCODE` is set) |
| `POST /api/undo` | `{ ids }` archives cards, returns `{ archived }` |
| `GET /api/board` | The board's lists and open cards, with priority parsed from labels |

Quick check from a terminal:

```
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{"transcript":"Sara needs to send the pricing deck by Friday, urgent.","today":"2026-10-30","preview":true}'
```

---

## Project structure

```
src/
  app/
    page.tsx              dictation UI, review window, undo
    board/page.tsx        live board view
    layout.tsx            fonts, backdrop
    globals.css           backdrop, panel, type scale, animations
    api/process|create|undo|board/route.ts
  components/
    Shell.tsx             shared frame: nav, hairline grid, clock, footer
    TaskCard.tsx          ticket card, editable review card, summary block
    Decor.tsx             glass word, draggable stickers
  lib/
    llm.ts                Gemini call, prompt, JSON parsing and retry
    tasks.ts              task sanitising, undo-command detection
    trello.ts             lists, members, labels, create, archive, duplicates, board read
    types.ts              shared types
```

---

## Demo script

1. **Hook (10 s):** "After every meeting, someone has to turn the chaos into tasks. I never touch the keyboard. Watch."
2. Show the empty app next to the Trello board (and `/board` in a second tab).
3. Click the field once, then hold the Wispr Flow key and dictate naturally, including filler words and a self-correction ("um, actually make that Thursday").
4. Pause. The glass word changes, the review cards appear with the countdown, then the cards are created.
5. Open one card to show owner, due date, label and list on Trello. Show it appear on `/board`.
6. **Bonus:** say "undo" and watch the batch disappear.
7. **Close:** "Voice in, real work out, zero typing."

Sample transcript:

> Okay so after the meeting, Sara needs to send the revised pricing deck to the client by Friday, it's pretty urgent. I need to book the venue for the offsite before end of next week. Also Ahmed should look into why the checkout page is slow, no rush, maybe sometime in the next two weeks. And somebody needs to email legal about the contract.

Backup plan: keep a screen recording of a successful run and the sample transcript in a text file.

Before presenting: do one warm-up run (the free Gemini tier can vary from about 2 s to over 20 s), and click the field first so Wispr Flow types into it.

---

## Known limits

- Not deployed; it runs locally. A public deployment needs an access guard, because anyone could otherwise write cards to your board.
- Owners are only assigned when they are members of the board; other names stay in the card description.
- The duplicate guard compares titles with a similarity threshold, so a heavily reworded duplicate can slip through.
- The `/board` page polls every 10 s rather than using Trello webhooks.
- No automated tests beyond manual smoke testing.
- Tested with simulated typing, not yet with real Wispr Flow dictation on every browser.

---

## Ideas to add product value

Ordered by value for effort. "S" is under an hour, "M" is a few hours, "L" is a day or more.

### Quick wins (S)

| Idea | Why it adds value |
| --- | --- |
| **Keyboard shortcuts** (Enter create now, Esc cancel review, U undo) | Power users and demos move faster |
| **Move cards by voice** ("move the pricing deck to Done") | Turns capture into full board control; reuses the existing list routing |
| **Teammate aliases** (map "Sara" or a nickname to a member) | Fixes assignment when names do not match exactly or Wispr mishears |
| **Default owner and due date** setting | Fewer unassigned or undated cards |
| **Dictation history** (last 10 in local storage, click to reuse) | Recover or repeat a dictation |
| **Copy summary as Markdown** | Paste meeting notes straight into Slack or email |
| **Toast and sound** on creation | Clear feedback when you are not looking at the screen |
| **Fix emoji on old cards** (script that moves emoji to labels) | One consistent board |

### Medium (M)

| Idea | Why it adds value |
| --- | --- |
| **Checklists from sub-steps** ("first draft it, then send it") | Better fidelity than splitting into separate cards |
| **Voice questions** ("what is due this week?", "what is Sara working on?") | Moves toward a true agent, not only capture |
| **Low-confidence highlighting** in the review window | Shows which fields the model was unsure about |
| **Board switcher / multiple projects** ("put this on the marketing board") | Real teams use several boards |
| **Trello webhooks** instead of polling on `/board` | Instant, cheaper live updates |
| **Notion, Linear, Jira, Asana adapters** behind one provider interface | Not tied to Trello; wider audience |
| **Post the summary** to Slack or email after each dictation | Closes the loop for the whole team |
| **Access guard and rate limit** (shared passcode) then deploy to Vercel | Judges and users can try it; protects your board |
| **Tests** for date resolution, undo detection and duplicate matching | Confidence when you change the prompt or models |
| **Dark theme** and a reduced-motion mode | Accessibility and personal preference |

### Larger bets (L)

| Idea | Why it adds value |
| --- | --- |
| **Calendar sync** (due dates and meetings to Google or Outlook) | Tasks land where people already look |
| **Recurring tasks** ("every Monday") | Common real-world need |
| **Meeting recording import** (transcribe, then run the same pipeline) | Capture without dictating |
| **Team workspace** with accounts, history and an audit log | Moves from demo to product |
| **Weekly digest** (what was created, done, overdue) | Shows ongoing value, not just capture |
| **Mobile app or PWA** with push-to-talk | Dictate on the way out of a meeting |
| **Multi-language dictation** | Wispr Flow supports many languages; the prompt can follow |

### Suggested order if time is short

1. Keyboard shortcuts and teammate aliases (small, helps every demo).
2. Move cards by voice (best "wow" per hour).
3. Access guard, then deploy so judges can try it.
4. Voice questions, as the step from capture to an agent.
