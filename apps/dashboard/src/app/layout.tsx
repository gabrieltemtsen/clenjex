import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "clenjex — Autonomous Trading Agent",
  description: "Live dashboard for the clenjex AI trading agent on Base",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
