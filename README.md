<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner.png">
    <img src="assets/logo.png" alt="VoiceBoard" width="420">
  </picture>
</p>

<p align="center"><strong>Talk. Cards appear.</strong></p>

<p align="center">
  Dictate a messy meeting with <a href="https://wisprflow.ai">Wispr Flow</a>. VoiceBoard files real Trello cards with owners, due dates, priorities and lists.
</p>

<p align="center">
  <a href="https://voiceboard-three.vercel.app">Live demo</a> ·
  <a href="media/brag.mp4">Launch video</a> ·
  <a href="#brand">Brand</a>
</p>

---

## Overview

After a meeting someone has to turn the chaos into tasks. VoiceBoard removes that step. You talk, it listens through Wispr Flow (which types into the focused field), and a model splits the ramble into clean action items. You get a moment to review and edit them, then they land on your Trello board.

## Features

**Capture**
- Hands-free: dictate, pause for 2.5 seconds, and it submits itself.
- One ramble becomes many tasks. Compound sentences are split and filler is ignored.
- Smart dates: "Friday", "end of next week" and "in two weeks" are resolved against today's date.
- Self-corrections are honoured ("actually make that Thursday").
- Urgency detection sets priority, and a one-line summary plus any stated decisions are extracted.

**Control**
- **Review window.** Parsed tasks appear as editable cards with a short countdown. Do nothing and they are created; touch a field to pause and edit title, owner, due date, priority or list.
- **Voice commands.** Say "undo" to archive the last batch, or "move the pricing deck to done" to move a card.
- **Duplicate guard.** A task that matches an open card is skipped and linked to the existing one.
- **Keyboard.** Ctrl/Cmd+Enter creates now; Esc cancels a review.

**Trello**
- Cards are created in parallel, with a per-card result so one failure never blocks the rest.
- Routing by status: "already in progress" goes to Doing, "already done" to Done.
- Owners are matched to board members and assigned ("me" maps to the token's account).
- Priority labels (P1 High, P2 Medium, P3 Low) are created on first use.
- Due dates, owner and notes are written to the card.

**Interface**
- Live `/board` page with To Do, Doing and Done columns, priority filters and automatic refresh.
- Copy the latest summary, decisions and tasks as Markdown.
- Responsive from phone to desktop.

**Safety**
- API keys and tokens stay on the server.
- Optional passcode gate (`APP_PASSCODE`) protects every page and API route, so a public deployment cannot write to your board.
- Inputs are validated, and cards are archived, never deleted.

## How it works

```
Browser
  input --(2.5 s pause)--> POST /api/process   transcript -> summary, decisions, tasks   (Gemini)
                                |
                                v
                          review window  (editable, short countdown)
                                |
                                v
                          POST /api/create     duplicate check -> create cards in parallel -> Trello
                                |
                                v
                          cards shown in the UI;  /board polls GET /api/board

  "undo"  -> POST /api/undo   archives the last batch
  "move ..." -> POST /api/move  moves the best-matching open card
```

## Quick start

Requires Node 18+, a Gemini API key and a Trello account.

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values below.
3. `npm run dev`, then open <http://localhost:3000>.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Model access ([get a key](https://aistudio.google.com/apikey)) |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-3.1-flash-lite` |
| `TRELLO_KEY`, `TRELLO_TOKEN` | Trello REST credentials ([Power-Up admin](https://trello.com/power-ups/admin)) |
| `TRELLO_BOARD_ID` | The board cards are written to. It needs lists named To Do, Doing and Done |
| `APP_PASSCODE` | Optional. Puts the whole app behind a passcode; use it in production |
| `NEXT_PUBLIC_TRELLO_BOARD_ID` | Optional. Enables the Trello links in the header |

`.env.local` is git-ignored. For a deployment, set the same variables in your host (for example Vercel).

## Pages and API

| Route | Purpose |
| --- | --- |
| `/` | Dictate, review, create, undo and move |
| `/board` | Live Trello board view |
| `POST /api/process` | `{ transcript, today, preview? }` extracts tasks; with `preview: true` it writes nothing |
| `POST /api/create` | `{ tasks }` creates reviewed tasks and returns the cards |
| `POST /api/move` | `{ query, list }` moves the best-matching open card |
| `POST /api/undo` | `{ ids }` archives cards |
| `POST /api/login` | `{ passcode }` signs in when `APP_PASSCODE` is set |
| `GET /api/board` | The board's lists and open cards |

## Project structure

```
src/
  app/
    page.tsx                 dictation UI, review window, voice commands
    board/page.tsx           live board view
    login/page.tsx           passcode sign-in
    api/{process,create,move,undo,login,board}/route.ts
  components/                Shell, TaskCard, Decor
  lib/                       llm.ts, trello.ts, tasks.ts, types.ts
  middleware.ts              optional passcode gate
assets/                      logo, wordmark and banner
media/                       launch video and poster
```

## Limitations

- Owners are only assigned when they are members of the board; other names stay in the card description.
- The duplicate guard compares titles by similarity, so a heavily reworded duplicate can slip through.
- `/board` polls every 10 seconds rather than using Trello webhooks.
- Model latency varies on the Gemini free tier.

## Brand

**VoiceBoard**: one word, capital V and B. Tagline: *Talk. Cards appear.*

### The mark

A speech bubble holds three columns of small cards. The bubble is the **voice**; the columns are the **board**. The columns rise and fall in height, so the same shape also reads as a sound wave. One simple symbol, two ideas, no extra detail.

The wordmark mirrors it: **Voice** in a light weight, **Board** in bold.

| Asset | Use |
| --- | --- |
| [`assets/logo.png`](assets/logo.png) | Mark and wordmark for light backgrounds |
| [`assets/logo-dark.png`](assets/logo-dark.png) | Mark and wordmark for dark backgrounds |
| [`assets/logo-mark.svg`](assets/logo-mark.svg) | The bubble mark alone, for headers and avatars |
| [`assets/icon.svg`](assets/icon.svg) | App icon: white bubble on an indigo squircle (also the favicon) |
| [`assets/banner.png`](assets/banner.png) | 1280x640 social preview |

**Usage.** Keep clear space of at least half the bubble's height. Use the mark at 16 px or larger and the full logo at 120 px wide or larger. Do not stretch, rotate, recolour, outline or add shadows. Use `logo-dark.png` on dark backgrounds, never the dark wordmark.

### Colour

| Colour | Hex | Use |
| --- | --- | --- |
| Ink | `#0B1220` | Wordmark and text |
| Sky | `#6FAAFF` | Gradient start |
| Indigo | `#6A4DFF` | Gradient end, accents |
| Mist | `#F0F3FB` | Light backgrounds |

The mark is a single diagonal gradient from Sky to Indigo with white cards.

### Typography

Archivo for the wordmark (Light 380 and ExtraBold 800, tight tracking) and the interface; JetBrains Mono for labels and the dictation field. Tone: short, plain and specific. Lead with what the product does, not how it is built.
---

Built for the Wispr Flow hackathon.
