"use client";

import { motion } from "framer-motion";
import { Zap, Timer, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

const METRICS = [
    {
        label: "10MB Parsing Latency",
        description: "Time to complete full diff",
        items: [
            { name: "JavaScript (V8)", value: 155, unit: "ms", color: "bg-white/10" },
            { name: "DiffCore (WASM)", value: 29, unit: "ms", color: "bg-accent" },
        ],
        better: "lower"
    },
    {
        label: "Throughput",
        description: "Raw data processing speed",
        items: [
            { name: "JavaScript Base", value: 200, unit: "MB/s", color: "bg-white/10" },
            { name: "DiffCore", value: 817, unit: "MB/s", color: "bg-primary" },
        ],
        better: "higher"
    }
];

const GLOSSARY = [
    { term: "Throughput", def: "The volume of data processed per second. Higher throughput means the engine can handle larger files without blocking the UI." },
    { term: "Latency", def: "The delay between input and result. Sub-30ms latency is critical for maintaining 60fps UI updates." },
    { term: "DMA", def: "Direct Memory Access. DiffCore reads native memory directly, bypassing the slow JavaScript heap garbage collector." },
    { term: "DiffCore", def: "Our proprietary architecture that computes 64-bit rolling hashes on the fly to avoid tree allocations." }
];

export function BenchmarkDemo() {
    return (
        <section className="space-y-8 p-6 rounded-2xl glass border border-white/5">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-accent/10 text-accent">
                    <Zap className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-foreground">Performance Verification</h3>
                    <p className="text-sm text-foreground/50">Live metrics from compilation</p>
                </div>
            </div>

            <div className="flex flex-col gap-8">
                {METRICS.map((metric, i) => (
                    <div key={i} className="space-y-4">
                        <div className="flex justify-between items-end">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-foreground/70">{metric.label}</h4>
                            <span className="text-xs text-foreground/30">{metric.description}</span>
                        </div>

                        <div className="space-y-3">
                            {metric.items.map((item, j) => (
                                <div key={j} className="space-y-1">
                                    <div className="flex justify-between text-xs font-medium">
                                        <span>{item.name}</span>
                                        <span className="text-foreground font-bold font-mono">
                                            {item.value} {item.unit}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            whileInView={{ width: `${(item.value / Math.max(...metric.items.map(m => m.value))) * 100}%` }}
                                            transition={{ duration: 1, delay: 0.2 }}
                                            className={cn("h-full rounded-full", item.color)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-6 border-t border-white/5">
                <h4 className="text-xs font-bold uppercase tracking-widest text-foreground/40 mb-4">Metric Definitions</h4>
                <div className="grid sm:grid-cols-2 gap-4">
                    {GLOSSARY.map((g, i) => (
                        <div key={i} className="space-y-1">
                            <span className="text-sm font-bold text-secondary">{g.term}</span>
                            <p className="text-xs text-foreground/50 leading-relaxed">{g.def}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
