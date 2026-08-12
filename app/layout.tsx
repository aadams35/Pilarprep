import type { Metadata } from "next";
import "./globals.css";
import "./product.css";

export const metadata: Metadata = {
  title: "PilarPrep | AWS SA Briefing Copilot",
  description:
    "An AWS-native briefing copilot for generating, refining, and promoting Solutions Architect briefs into delivery-ready project models.",
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
