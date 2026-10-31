"use client";

import { useState } from "react";

export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: code }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      setError((await res.json().catch(() => ({}))).error || "Could not sign in.");
    } catch {
      setError("Couldn't reach the server.");
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="panel w-full max-w-[420px] p-7 shadow-[0_40px_90px_rgba(10,30,120,0.35)]">
        <p className="t-label font-bold">VoiceBoard.app</p>
        <h1 className="t-display mt-6">Talk.
          <br />
          Cards appear.
        </h1>
        <p className="t-body mt-4">This demo writes to a real Trello board, so it needs a passcode.</p>
        <label className="t-label mt-6 block" htmlFor="code">
          Passcode
        </label>
        <input
          id="code"
          type="password"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="t-input mt-1.5 w-full border border-[#07162b] bg-white/45 p-3 focus:bg-white/70 focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="t-label text-[#c01138]" aria-live="polite">
            {error}
          </p>
          <button
            disabled={busy || !code}
            className="t-label shrink-0 border border-[#07162b] px-4 py-2.5 transition-colors hover:bg-[#07162b] hover:text-[#eef6fd] disabled:opacity-40"
          >
            Enter ↵
          </button>
        </div>
      </form>
    </div>
  );
}
