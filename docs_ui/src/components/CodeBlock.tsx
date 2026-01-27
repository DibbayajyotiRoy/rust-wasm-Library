"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface CodeBlockProps {
    code: string;
    language?: string;
    className?: string;
}

export function CodeBlock({ code, className }: CodeBlockProps) {
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
        <div className={cn("relative group mt-4 rounded-xl bg-[#1e1e1e] border border-white/5 overflow-hidden", className)}>
            <button
                onClick={copyToClipboard}
                className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors backdrop-blur-sm z-10"
                title="Copy to clipboard"
            >
                <AnimatePresence mode="wait" initial={false}>
                    {copied ? (
                        <motion.div
                            key="check"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Check className="w-4 h-4 text-emerald-400" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="copy"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Copy className="w-4 h-4" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </button>
            <div className="p-5 pt-6 overflow-x-auto text-xs leading-normal font-mono">
                <pre className="text-gray-300">
                    <code>{code}</code>
                </pre>
            </div>
        </div>
    );
}
