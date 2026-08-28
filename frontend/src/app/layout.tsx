import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeakLens — See where your money leaks",
  description: "AI-powered merchant settlement intelligence and deterministic financial reconciliation platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#080b11] text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
