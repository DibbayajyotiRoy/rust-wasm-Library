"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
    code: string;
    language?: string;
    className?: string;
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy!", err);
        }
    };

    return (
        <div className={cn("relative group mt-4 rounded-xl bg-black/40 border border-white/5 overflow-hidden", className)}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5">
                <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold">
                    {language || "code"}
                </span>
                <button
                    onClick={copyToClipboard}
                    className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                    title="Copy to clipboard"
                >
                    {copied ? (
                        <Check className="w-3.5 h-3.5 text-accent" />
                    ) : (
                        <Copy className="w-3.5 h-3.5" />
                    )}
                </button>
            </div>
            <div className="p-4 overflow-x-auto text-xs leading-normal">
                <pre className="text-secondary">
                    <code>{code}</code>
                </pre>
            </div>
        </div>
    );
}
