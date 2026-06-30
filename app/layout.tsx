import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeetingMind — Intelligent Action Item Orchestrator",
  description: "Multi-agent AI pipeline that extracts meeting action items, resolves calendar conflicts, checks for sheets duplication, and supports human-in-the-loop approvals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground selection:bg-zinc-700/50">
        {children}
      </body>
    </html>
  );
}
