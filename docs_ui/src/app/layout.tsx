import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "DiffCore – High-Performance JSON Diff Engine (Rust + WebAssembly)",
  description: "DiffCore is a high-performance JSON diff engine built in Rust and WebAssembly, delivering deterministic, zero-GC comparison for large and streaming documents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} dark`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
