"use client";

import { motion } from "framer-motion";
import { ArrowDown, Cpu, Database, FileJson, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function ArchitectureDiagram() {
    const steps = [
        { icon: FileJson, label: "Raw JSON Stream", sub: "Chunks" },
        { icon: Database, label: "Zero-Copy Arena", sub: "WASM Memory" },
        { icon: Cpu, label: "SIMD V128 Parser", sub: "Rust/C++ Core" },
        { icon: Zap, label: "Diff Engine", sub: "Single-Pass" },
        { icon: FileJson, label: "Structural Output", sub: "Deterministic" }
    ];

    return (
        <div className="relative py-12 px-6 rounded-3xl bg-black/40 border border-white/5 overflow-hidden">
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 max-w-5xl mx-auto">
                {steps.map((step, i) => (
                    <div key={i} className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className="relative group"
                        >
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm">
                                <step.icon className="w-6 h-6 text-foreground/80" />
                            </div>
                            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                                <div className="text-xs font-bold uppercase tracking-widest text-foreground/90">{step.label}</div>
                                <div className="text-[10px] text-foreground/40 font-mono mt-1">{step.sub}</div>
                            </div>
                        </motion.div>

                        {i < steps.length - 1 && (
                            <motion.div
                                initial={{ opacity: 0, width: 0 }}
                                whileInView={{ opacity: 1, width: "100%" }}
                                transition={{ delay: i * 0.1 + 0.1, duration: 0.5 }}
                                className="h-8 w-0.5 md:w-12 md:h-0.5 bg-gradient-to-b md:bg-gradient-to-r from-transparent via-primary/50 to-transparent flex items-center justify-center shrink-0"
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_currentColor] text-primary" />
                            </motion.div>
                        )}
                    </div>
                ))}
            </div>

            {/* Animated signal line */}
            <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2 opacity-20 pointer-events-none">
                <motion.div
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="w-1/3 h-full bg-gradient-to-r from-transparent via-primary to-transparent"
                />
            </div>
        </div>
    );
}
