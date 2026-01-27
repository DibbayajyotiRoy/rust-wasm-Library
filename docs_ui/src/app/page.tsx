"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Cpu, Layers, Github, Terminal, ArrowRight, Trash2, Repeat, Box } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Step } from "@/components/Step";
import { BenchmarkDemo } from "@/components/BenchmarkDemo";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { cn } from "@/lib/utils";

const HERO_METRICS = [
  { value: "29ms", label: "Latency (10MB)" },
  { value: "817 MB/s", label: "Throughput" },
  { value: "0", label: "GC Pauses" },
  { value: "SIMD", label: "Zero-Copy" },
];

const ONBOARDING_STEPS = [
  {
    title: "1. INSTALL CORE",
    desc: "Direct GitHub link. No registry latency.",
    code: "bun add https://github.com/DibbayajyotiRoy/rust-wasm-Library\n# or\nnpm install https://github.com/DibbayajyotiRoy/rust-wasm-Library"
  },
  {
    title: "2. INITIALIZE ENGINE",
    desc: "Pre-allocate linear memory arenas.",
    code: "import { DiffEngine } from './pkg/diffcore.js';\n// Explicit memory binding for zero-copy\nconst engine = new DiffEngine(wasm, { computeMode: 'Throughput' });"
  },
  {
    title: "3. STREAM & DIFF",
    desc: "Zero-allocation execution loop.",
    code: "// Writes directly to WASM memory offset, bypassing JS heap\nconst lp = engine.getLeftInputPtr();\nnew Uint8Array(wasm.memory.buffer, lp, b1.length).set(b1);\nengine.commitLeft(b1.length);\nengine.finalize();"
  }
];

const DOCS_CONTENT = {
  web: [
    {
      title: "Integrate via GitHub",
      description: "Import DiffCore directly as a GitHub dependency to ensure you have the latest DiffCore optimizations.",
      code: "bun add https://github.com/DibbayajyotiRoy/rust-wasm-Library"
    },
    {
      title: "Initialize Engine Instance",
      description: "Load the WebAssembly binary and initialize the DiffCore engine with explicit memory bindings.",
      code: "import { DiffEngine } from './pkg/diffcore.js';\n\nconst engine = new DiffEngine(wasm, { computeMode: 'Throughput' });"
    },
    {
      title: "Execute Zero-GC Diff",
      description: "Stream raw bytes into linear memory. The unified single-pass parser enables deterministic execution.",
      code: "const lp = engine.getLeftInputPtr();\nnew Uint8Array(wasm.memory.buffer, lp, b1.length).set(b1);\nengine.commitLeft(b1.length);\n\nconst diffs = engine.finalize();"
    }
  ],
  mobile: [
    {
      title: "Configure Git Submodule",
      description: "Add DiffCore as a git submodule to ensure native compilation for ARM targets.",
      code: "git submodule add https://github.com/DibbayajyotiRoy/rust-wasm-Library\ncd rust-wasm-Library && cargo build --release --target aarch64-linux-android"
    },
    {
      title: "Map Symbolic Headers",
      description: "Include the C++ headers to expose the raw DiffCore parser.",
      code: "#include \"rust-wasm-Library/cpp/include/parser.h\"\n#include \"rust-wasm-Library/cpp/include/engine.h\""
    },
    {
      title: "Bind Native Buffers",
      description: "Map native memory buffers for direct ingestion.",
      code: "auto engine = new silicon::Engine(config);\nengine->commit_left(nativeBuffer, length);\nauto result = engine->finalize();"
    }
  ],
  desktop: [
    {
      title: "Link Cargo Dependency",
      description: "Add the engine as a direct Git dependency in `Cargo.toml`.",
      code: "[dependencies]\ndiffcore = { git = \"https://github.com/DibbayajyotiRoy/rust-wasm-Library\" }"
    },
    {
      title: "Setup Shared Bus Memory",
      description: "Establish a shared memory bus between the Node.js process and Rust core.",
      code: "use diffcore::Engine;\n\nlet mut engine = Engine::new(config);\nengine.push_left(raw_bytes);"
    },
    {
      title: "Run Real-time Monitoring",
      description: "Deploy for low-latency state monitoring.",
      code: "engine.watch(path).on('change', (diff) => {\n   app.dispatch({ type: 'UPDATE_STATE', diff });\n});"
    }
  ]
};

export default function Home() {
  const [activeTab, setActiveTab] = useState("web");
  const [activeStep, setActiveStep] = useState(0);

  const currentSteps = DOCS_CONTENT[activeTab as keyof typeof DOCS_CONTENT];
  const activeContent = currentSteps[activeStep];

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans">

      {/* 1. NAVBAR */}
      <div className="border-b border-secondary/10 bg-surface/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between text-xs font-mono text-foreground/60 tracking-wider font-medium">
          <div className="flex gap-4 sm:gap-8 items-center">
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500" />MIT LICENSE</span>
            <span className="hidden sm:inline">RUST/C++ CORE</span>
            <span className="hidden sm:inline">NO TELEMETRY</span>
          </div>
          <motion.a
            href="https://github.com/DibbayajyotiRoy/rust-wasm-Library"
            target="_blank"
            className="flex items-center gap-2 text-foreground font-bold hover:text-accent transition-colors"
            whileHover="hover"
            initial="initial"
          >
            <motion.div
              variants={{
                initial: { rotate: 0 },
                hover: { rotate: 360, scale: 1.1 }
              }}
              transition={{ duration: 0.5, ease: "backOut" }}
            >
              <Github className="w-5 h-5" />
            </motion.div>
            <span className="hidden sm:inline tracking-widest pl-1">STAR ON GITHUB</span>
          </motion.a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-12 pb-32">

        {/* MAIN GRID LAYOUT */}
        <div className="grid lg:grid-cols-3 gap-12 lg:gap-24 items-start">

          {/* LEFT CONTENT COLUMN */}
          <div className="lg:col-span-2 space-y-32">

            {/* 2. HERO SECTION */}
            <header className="space-y-12">
              <div className="space-y-8">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-accent text-xs font-bold tracking-widest uppercase"
                >
                  <Zap className="w-3 h-3" />
                  DiffCore Released
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.9]"
                >
                  Zero-Garbage Collection <br />
                  JSON Diff Engine.
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl md:text-2xl text-foreground/60 font-medium max-w-xl leading-relaxed"
                >
                  SIMD-accelerated Rust/C++ core that replaces V8 parsing for real-time diffs.
                  <span className="text-foreground font-bold border-b-2 border-accent/20 font-mono"> 29ms </span> for 10MB payloads. Runs in WASM.
                </motion.p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-black/5 border-y border-black/5 py-8">
                {HERO_METRICS.map((m, i) => (
                  <div key={i} className="px-6 space-y-1 first:pl-0">
                    <div className="text-2xl md:text-3xl font-mono font-bold text-primary tracking-tighter leading-none">{m.value}</div>
                    <div className="text-[10px] uppercase tracking-widest text-foreground/40 font-bold leading-none">{m.label}</div>
                  </div>
                ))}
              </div>
            </header>

            {/* 3. THE PROBLEM (Narrative + Diagram) */}
            <section className="space-y-12">
              <div className="space-y-4">
                <h2 className="text-3xl md:text-5xl font-black text-secondary tracking-tight">Why standard JS parsing fails at scale — and why DiffCore doesn’t.</h2>
                <p className="text-lg text-foreground/70 leading-relaxed font-medium border-l-4 border-red-500/30 pl-6 py-2">
                  When JSON payloads grow, JavaScript parsers allocate millions of objects. The V8 engine eventually freezes execution to clean them up.
                </p>
              </div>

              {/* Visual Flow */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center p-8 bg-secondary/5 border-t border-black/10">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 text-sm font-mono text-foreground/60">
                    <span>JSON Input Grows</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-4 text-sm font-mono text-foreground/80 font-bold">
                    <span>Heap Fills</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-4 text-sm font-mono text-red-600 font-bold">
                    <span>GC Threshold Reached</span>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute left-[-24px] top-1/2 -translate-y-1/2 hidden md:block">
                    <ArrowRight className="w-6 h-6 text-foreground/20" />
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 p-8 text-center space-y-3">
                    <div className="text-xs font-bold uppercase tracking-widest text-red-600">Garbage Collection</div>
                    <div className="text-2xl font-bold text-red-600 leading-tight">Application Frozen for 155ms</div>
                  </div>
                </div>
              </div>

              {/* CONSOLIDATED CONTRAST BLOCK */}
              <div className="mt-10 pt-6 border-t border-black/10">
                <p className="text-lg md:text-xl font-medium text-foreground/70 leading-relaxed">
                  <span className="text-accent font-bold font-mono">
                    DiffCore avoids the causes entirely:
                  </span>{" "}
                  <span className="font-mono font-bold text-foreground">
                    garbage collection, recursive traversal, JS object graphs, heap churn
                  </span>
                </p>
              </div>

              {/* Competitive Matrix (Moved to Main Column) */}
              <div className="pt-8 border-t border-black/10">
                <h3 className="text-sm font-bold uppercase tracking-widest mb-6 text-foreground/50">End-to-End Diff Latency (10MB JSON)</h3>
                <div className="space-y-4 text-base font-mono">
                  {[
                    { name: "jsondiffpatch", value: "155ms", reason: "(GC Pause)", status: "bad" },
                    { name: "deep-diff", value: "142ms", reason: "(Recursive)", status: "bad" },
                    { name: "DiffCore", value: "29ms", reason: "(Zero-GC)", status: "good" }
                  ].map((c, i) => (
                    <div key={i} className="flex justify-between items-center group py-3 border-b border-black/5 last:border-0">
                      <span className={cn("font-bold", c.status === "good" ? "text-foreground" : "text-foreground/40")}>{c.name}</span>
                      <div className="text-right flex items-center gap-4">
                        <span className={cn("font-bold", c.status === "good" ? "text-accent" : "text-foreground/40")}>{c.value}</span>
                        <span className="text-xs text-foreground/30 hidden sm:inline-block w-24 text-right">{c.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-foreground/30 mt-4">* JS libraries include GC pauses. DiffCore does not.</p>
              </div>
            </section>

            {/* 4. ARCHITECTURE (Boundary Diagram) */}
            <section className="space-y-12">
              <div className="space-y-6">
                <h2 className="text-3xl md:text-5xl font-black tracking-tight font-mono">How DiffCore Bypasses the JavaScript Runtime</h2>
              </div>
              <ArchitectureDiagram />
            </section>

            {/* Bridge Sentence to Onboarding */}
            <p className="text-foreground/60 text-lg font-medium max-w-2xl border-t-2 border-black/10 pt-8">
              This architecture is exposed directly to JavaScript through a minimal WASM interface.
            </p>

          </div>

          {/* RIGHT STICKY COLUMN */}
          <div className="hidden lg:block lg:col-span-1 pt-12">
            <div className="sticky top-24 space-y-8">
              <BenchmarkDemo />
              {/* Cleaned up sidebar (Matrix moved) */}
              <div className="p-6 bg-surface/50 border border-black/5 text-xs text-foreground/40 leading-relaxed rounded-xl">
                <span className="font-bold text-foreground/60 block mb-2">LIVE MONITOR</span>
                Real-time metrics from the current compilation target. Throughput may vary by CPU generation.
              </div>
            </div>
          </div>

        </div>

        {/* 6. CONSOLIDATED INTEGRATION SECTION */}
        <section id="onboarding" className="space-y-8 pt-24 mt-24 border-t border-black/10">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-12">Get Started in 3 Steps</h2>

          <div className="flex flex-col lg:flex-row gap-12 lg:gap-24">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              className="shrink-0"
            >
              <Navigation activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setActiveStep(0); }} />
            </motion.div>

            <div className="flex-1 space-y-8">
              {currentSteps.map((step, i) => (
                <div key={i} onClick={() => setActiveStep(i)} className="cursor-pointer">
                  <Step
                    number={i + 1}
                    title={step.title}
                    description={step.description}
                    code={step.code}
                    active={activeStep === i}
                    language="bash"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="pt-32 border-t border-black/10 flex flex-wrap justify-between gap-8 text-foreground/40 items-end">
          <div className="space-y-4 text-xs font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full" /> All Systems Operational</div>
            <div className="flex gap-8">
              <span>© 2026 DiffCore</span>
              <a href="https://github.com/DibbayajyotiRoy/rust-wasm-Library" className="hover:text-foreground">MIT License</a>
              <a href="#" className="hover:text-foreground">Documentation</a>
            </div>
          </div>

          <div className="text-[10px] sm:text-xs opacity-50 max-w-md text-right leading-relaxed font-mono">
            SIMD Enabled JSON Diff Engine. Zero-GC WebAssembly JSON Parser. High-Throughput Rust WASM Library.
            Deterministic JSON comparison for high-performance systems. Evaluted against jsondiffpatch, deep-diff, and jq.
          </div>
        </footer>
      </div>
    </main>
  );
}
