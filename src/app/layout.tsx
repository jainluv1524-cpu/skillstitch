import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkillStitch | Personalized Project & Skill-Gap Planner",
  description: "Analyze your skills, find gaps for a target role, and get tailored mini-project recommendations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
