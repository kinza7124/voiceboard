import type { Metadata } from "next";
import { Archivo, JetBrains_Mono, Pacifico } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const script = Pacifico({ weight: "400", subsets: ["latin"], variable: "--font-script", display: "swap" });

export const metadata: Metadata = {
  title: { default: "VoiceBoard: Talk. Cards appear.", template: "%s | VoiceBoard" },
  description:
    "Dictate a messy meeting brain-dump with Wispr Flow and VoiceBoard files real Trello cards with owners, due dates, priorities and lists.",
  applicationName: "VoiceBoard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${mono.variable} ${script.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <div className="holo" aria-hidden />
        {children}
      </body>
    </html>
  );
}
