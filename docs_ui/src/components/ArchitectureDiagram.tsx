"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export function ArchitectureDiagram() {
    return (
        <div className="relative py-20 select-none cursor-default max-w-5xl mx-auto">

            {/* 1. JS / WASM BOUNDARY MARKER */}
            <div className="absolute top-0 bottom-0 left-[32%] w-px border-l-2 border-dashed border-red-500/30 hidden md:block">
                <div className="absolute top-0 -left-px -translate-x-1/2 bg-background px-2 text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest whitespace-nowrap">
                    JS / V8 Boundary
                </div>
                <div className="absolute bottom-10 left-4 text-xs font-medium text-red-500/60 w-32 hidden lg:block">
                    Execution leaves the JavaScript heap here.
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 items-start relative z-10">

                {/* NODE 1: JS HEAP (Fragile / Muted) */}
                <div className="relative flex flex-col items-center text-center space-y-4 opacity-60 hover:opacity-100 transition-opacity duration-500">
                    <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-foreground/30 flex items-center justify-center bg-background z-20">
                        <span className="font-mono text-xs font-bold text-foreground/50">V8</span>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/70">JavaScript Heap</h3>
                        <p className="text-xs text-foreground/50 font-mono leading-relaxed max-w-[200px] mx-auto">
                            Objects, recursion, garbage collection. <br />
                            <span className="text-red-500/70">Unbounded latency.</span>
                        </p>
                    </div>
                    {/* Mobile Arrow */}
                    <ArrowRight className="md:hidden w-5 h-5 text-foreground/20 rotate-90" />
                </div>

                {/* CONNECTION 1-2 (Desktop) */}
                <div className="hidden md:block absolute top-8 left-[16%] right-[50%] h-0.5 bg-gradient-to-r from-foreground/10 to-foreground/30 -z-10" />

                {/* NODE 2: WASM LINEAR (Technical / Neutral) */}
                <div className="relative flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full border-2 border-foreground flex items-center justify-center bg-surface z-20 shadow-sm">
                        <div className="w-3 h-3 bg-foreground rounded-full" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">WASM Linear Memory</h3>
                        <p className="text-xs text-foreground/70 font-mono leading-relaxed max-w-[200px] mx-auto">
                            Single contiguous buffer. Zero-copy writes. <br />
                            <span className="text-foreground font-bold">No heap growth.</span>
                        </p>
                    </div>
                    <ArrowRight className="md:hidden w-5 h-5 text-foreground/20 rotate-90" />
                </div>

                {/* CONNECTION 2-3 (Desktop) */}
                <div className="hidden md:block absolute top-8 left-[50%] right-[16%] h-0.5 bg-gradient-to-r from-foreground/30 to-accent/50 -z-10" />

                {/* NODE 3: NATIVE SIMD (Bold / Accent) */}
                <div className="relative flex flex-col items-center text-center space-y-4 group">
                    <motion.div
                        whileHover={{ scale: 1.1 }}
                        className="w-20 h-20 rounded-xl bg-accent text-white flex items-center justify-center shadow-xl shadow-accent/20 z-20"
                    >
                        <ZapIcon />
                    </motion.div>
                    <div className="space-y-2">
                        <h3 className="text-base font-black uppercase tracking-widest text-accent">Native SIMD Engine</h3>
                        <p className="text-xs md:text-sm text-foreground font-mono font-bold leading-relaxed max-w-[220px] mx-auto">
                            Single-pass structural diff.<br />
                            Deterministic latency.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}

function ZapIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
    )
}
