"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeBlock } from "@/components/CodeBlock";

interface StepProps {
    number: number;
    title: string;
    description: string;
    code?: string;
    language?: string;
    active?: boolean;
}

export function Step({ number, title, description, code, language = "bash", active }: StepProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
                "p-6 rounded-2xl transition-all duration-300",
                active ? "glass glow-primary scale-[1.02]" : "opacity-50 grayscale scale-100"
            )}
        >
            <div className="flex items-start gap-4">
                <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                    active ? "bg-primary text-background" : "bg-white/10 text-white/40"
                )}>
                    {number}
                </div>
                <div className="flex-1 space-y-2">
                    <h3 className="text-xl font-semibold tracking-tight uppercase tracking-widest text-primary flex items-center gap-2">
                        {title}
                        {active && <CheckCircle2 className="w-4 h-4" />}
                    </h3>
                    <p className="text-foreground/60 leading-relaxed text-sm">
                        {description}
                    </p>

                    {code && active && (
                        <CodeBlock code={code} language={language} />
                    )}
                </div>
            </div>
        </motion.div>
    );
}
