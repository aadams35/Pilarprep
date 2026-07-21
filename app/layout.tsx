import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PillarPrep | AWS SA Briefing Console",
  description:
    "A professional front end for generating, refining, and promoting AWS Solutions Architect briefs into project models.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
