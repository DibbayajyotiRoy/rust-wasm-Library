import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  metadataBase: new URL("https://rust-wasm-library.vercel.app"),
  title: "diffcore – Fast WebAssembly JSON Diff Engine for JS / TS",
  description:
    "Fast WASM JSON diff with real JSON Pointer paths, applyPatch, revertPatch, RFC 6902 output, undo/redo, three-way merge, React hook, and CLI. Zero config.",
  keywords: [
    "json diff", "json patch", "rfc 6902", "json pointer", "webassembly",
    "wasm", "rust", "typescript", "three-way merge", "undo redo",
    "state management", "optimistic ui", "react",
  ],
  authors: [{ name: "DibbayajyotiRoy" }],
  openGraph: {
    title: "diffcore – Fast WebAssembly JSON Diff Engine",
    description:
      "Real JSON Pointer paths. applyPatch + revertPatch. RFC 6902 output. Undo/redo, three-way merge, React hook, and CLI. ~38 KB WASM. Zero config.",
    type: "website",
    url: "https://rust-wasm-library.vercel.app",
    siteName: "diffcore",
  },
  twitter: {
    card: "summary_large_image",
    title: "diffcore – Fast WebAssembly JSON Diff Engine",
    description:
      "Real JSON Pointer paths, applyPatch + revertPatch, RFC 6902 output, undo/redo + 3-way merge. 3–4× faster than JS. Zero config.",
  },
  alternates: {
    canonical: "https://rust-wasm-library.vercel.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${outfit.variable}`}>
      <body className="antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
