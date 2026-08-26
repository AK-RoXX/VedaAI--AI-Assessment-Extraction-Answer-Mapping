import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VedaAI – AI Teacher's Toolkit",
  description:
    "Upload a question paper and student answer sheet. VedaAI extracts questions, maps answers, highlights answer regions, and provides AI-powered grading and feedback.",
  keywords: ["teacher", "grading", "AI", "answer sheet", "question paper", "VedaAI"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
