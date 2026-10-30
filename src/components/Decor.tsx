"use client";

import { useRef, useState } from "react";

/** Inflated, glassy script word built from an SVG lighting filter. */
export function GlassWord({ word }: { word: string }) {
  const size = word.length <= 5 ? 300 : word.length <= 7 ? 240 : 200;
  return (
    <svg viewBox="0 -50 1000 420" className="h-full w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="glassFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5f8dff" />
          <stop offset="55%" stopColor="#9fc2ff" />
          <stop offset="100%" stopColor="#7ea6ff" />
        </linearGradient>
        <filter id="inflate" x="-15%" y="-70%" width="130%" height="240%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="b1" />
          <feSpecularLighting in="b1" surfaceScale="11" specularConstant="1.3" specularExponent="26" lightingColor="#ffffff" result="spec">
            <feDistantLight azimuth="225" elevation="50" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b2" />
          <feDiffuseLighting in="b2" surfaceScale="7" diffuseConstant="1.05" lightingColor="#ffffff" result="diff">
            <feDistantLight azimuth="225" elevation="58" />
          </feDiffuseLighting>
          <feComposite in="diff" in2="SourceAlpha" operator="in" result="diffIn" />
          <feComposite in="SourceGraphic" in2="diffIn" operator="arithmetic" k1="0.55" k2="0.62" k3="0.12" k4="0" result="shaded" />
          <feComposite in="shaded" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lit" />
          <feDropShadow in="lit" dx="0" dy="16" stdDeviation="13" floodColor="#2749c9" floodOpacity="0.32" />
        </filter>
      </defs>
      <g className="word-in" key={word} style={{ transformOrigin: "50% 60%" }}>
        <text
          x="500"
          y="250"
          textAnchor="middle"
          fontFamily="var(--font-script), cursive"
          fontSize={size}
          fill="url(#glassFill)"
          stroke="url(#glassFill)"
          strokeWidth="12"
          strokeLinejoin="round"
          filter="url(#inflate)"
        >
          {word}
        </text>
      </g>
    </svg>
  );
}

/** Wrapper that lets a sticker be dragged around the panel. */
export function Draggable({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const start = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  return (
    <div
      className={`${className} cursor-grab touch-none select-none active:cursor-grabbing`}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        setPos({ x: start.current.ox + e.clientX - start.current.x, y: start.current.oy + e.clientY - start.current.y });
      }}
      onPointerUp={() => {
        start.current = null;
      }}
    >
      {children}
    </div>
  );
}

export function GreenSticker() {
  return (
    <svg width="150" height="124" viewBox="0 0 150 124" className="drop-shadow-[0_6px_10px_rgba(7,22,43,0.25)]">
      <defs>
        <filter id="glitch" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015 0.09" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="10" />
        </filter>
      </defs>
      <path
        d="M20 58 C14 22 54 8 86 14 C122 8 144 32 136 64 C142 98 106 114 72 108 C36 114 10 94 20 58 Z"
        fill="#62e03c"
        stroke="#fff"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <g transform="rotate(-10 75 60)" filter="url(#glitch)" fontFamily="var(--font-archivo), sans-serif" fontWeight="900" fill="#07162b">
        <text x="75" y="55" textAnchor="middle" fontSize="30">WISPR</text>
        <text x="75" y="88" textAnchor="middle" fontSize="30">FLOW</text>
      </g>
    </svg>
  );
}

export function PinkSticker() {
  return (
    <svg width="92" height="124" viewBox="0 0 92 124" className="drop-shadow-[0_6px_10px_rgba(7,22,43,0.2)]">
      <g transform="rotate(10 46 62)">
        <rect x="8" y="6" width="76" height="112" rx="14" fill="#ffd3ea" stroke="#fff" strokeWidth="6" />
        <text
          transform="translate(60 62) rotate(90)"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="var(--font-mono), monospace"
          fontWeight="800"
          fontSize="40"
          fill="none"
          stroke="#ff2d8f"
          strokeWidth="2"
          style={{ filter: "drop-shadow(0 0 5px #ff2d8f)" }}
        >
          2026
        </text>
      </g>
    </svg>
  );
}

export function BlueCursor() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="drop-shadow-[0_14px_16px_rgba(30,60,200,0.35)]">
      <defs>
        <linearGradient id="cur" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7fb0ff" />
          <stop offset="100%" stopColor="#1f5cff" />
        </linearGradient>
      </defs>
      <polygon points="18,16 78,44 50,54 40,82" fill="url(#cur)" stroke="url(#cur)" strokeWidth="14" strokeLinejoin="round" />
      <polygon points="26,24 62,41 46,47" fill="#fff" opacity="0.35" />
    </svg>
  );
}
