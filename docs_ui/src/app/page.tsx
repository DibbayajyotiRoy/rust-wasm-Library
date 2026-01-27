"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Cpu, Layers, Github, Terminal, ArrowRight } from "lucide-react";
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
    title: "Install Core",
    code: "bun add https://github.com/DibbayajyotiRoy/rust-wasm-Library",
    desc: "Direct GitHub link. No registry latency."
  },
  {
    title: "Init Engine",
    code: "const engine = new DiffEngine(wasm, { mode: 'Throughput' });",
    desc: "Pre-allocate linear memory arenas."
  },
  {
    title: "Stream & Diff",
    code: "engine.commitLeft(buf); engine.finalize();",
    desc: "Zero-allocation execution loop."
  }
];

const DOCS_CONTENT = {
  web: [
    {
      title: "Integrate via GitHub",
      description: "Import DiffCore directly as a GitHub dependency to ensure you have the latest Silicon Path optimizations. This bypasses registry delays and provides direct access to the raw WASM assets.",
      code: "bun add https://github.com/DibbayajyotiRoy/rust-wasm-Library\n# or\nnpm install https://github.com/DibbayajyotiRoy/rust-wasm-Library"
    },
    {
      title: "Initialize Engine Instance",
      description: "Load the WebAssembly binary and initialize the DiffCore engine with explicit memory bindings. This allows for zero-allocation diffing by pre-allocating the required linear memory upfront.",
      code: "import { DiffEngine } from './pkg/diffcore.js';\n\nconst engine = new DiffEngine(wasm, { computeMode: 'Throughput' });"
    },
    {
      title: "Execute Zero-GC Diff",
      description: "Stream raw bytes into linear memory. The unified single-pass parser enables deterministic execution at 817MB/s (measured on large sequential payloads with pre-allocated memory).",
      code: "const lp = engine.getLeftInputPtr();\nnew Uint8Array(wasm.memory.buffer, lp, b1.length).set(b1);\nengine.commitLeft(b1.length);\n\nconst diffs = engine.finalize();"
    }
  ],
  mobile: [
    {
      title: "Configure Git Submodule",
      description: "Add DiffCore as a git submodule. This guarantees that the native Rug core compiles for your specific ARM target (Android/iOS) without relying on pre-built generic binaries.",
      code: "git submodule add https://github.com/DibbayajyotiRoy/rust-wasm-Library\ncd rust-wasm-Library && cargo build --release --target aarch64-linux-android"
    },
    {
      title: "Map Symbolic Headers",
      description: "Include the C++ headers. This bridge mapping exposes the raw Silicon Path parser to your native layer, removing the serialization overhead typical of JS-to-Native bridges.",
      code: "#include \"rust-wasm-Library/cpp/include/parser.h\"\n#include \"rust-wasm-Library/cpp/include/engine.h\""
    },
    {
      title: "Bind Native Buffers",
      description: "Map native memory buffers. Direct memory ingestion allows processing multi-megabyte payloads in <16ms frames, keeping the UI thread unblocked.",
      code: "auto engine = new silicon::Engine(config);\nengine->commit_left(nativeBuffer, length);\nauto result = engine->finalize();"
    }
  ],
  desktop: [
    {
      title: "Link Cargo Dependency",
      description: "Add the engine as a direct Git dependency in `Cargo.toml`. This enables static linking for rust-based desktop apps (Tauri), resulting in smaller binaries and faster startup than dynamic libraries.",
      code: "[dependencies]\ndiffcore = { git = \"https://github.com/DibbayajyotiRoy/rust-wasm-Library\" }"
    },
    {
      title: "Setup Shared Bus Memory",
      description: "Establish a shared memory bus. By sharing memory between the Node.js main process and the Rust core, you eliminate the serialization cost for large state objects.",
      code: "use diffcore::Engine;\n\nlet mut engine = Engine::new(config);\nengine.push_left(raw_bytes);"
    },
    {
      title: "Run Real-time Monitoring",
      description: "Deploy for low-latency state monitoring. The zero-allocation loop enables continuous diffing of 10MB+ state trees without inducing GC pauses that cause UI stutter.",
      code: "engine.watch(path).on('change', (diff) => {\n   app.dispatch({ type: 'UPDATE_STATE', diff });\n});"
    }
  ]
};

export default function Home() {
  const [activeTab, setActiveTab] = useState("web");
  const [activeStep, setActiveStep] = useState(0);

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans">

      {/* 1. TRUST BLOCK / NAVBAR */}
      <div className="border-b border-secondary/10 bg-surface/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between text-[10px] md:text-xs font-mono text-foreground/60 tracking-wider font-medium">
          <div className="flex gap-4 sm:gap-8">
            <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500" />MIT LICENSE</span>
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
            <span className="hidden sm:inline text-[10px] tracking-widest pl-1">STAR ON GITHUB</span>
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
                  v2.2 Silicon Path Released
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9]"
                >
                  Zero-GC JSON <br />
                  Diff Engine.
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl md:text-2xl text-foreground/60 font-medium max-w-xl leading-relaxed"
                >
                  SIMD-accelerated Rust/C++ core that replaces V8 parsing for real-time diffs.
                  <span className="text-foreground font-bold border-b-2 border-accent/20"> 29ms </span> for 10MB payloads. Runs in WASM.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-wrap gap-4 pt-4"
                >
                  <a href="#onboarding" className="bg-primary hover:bg-primary/90 text-background px-8 py-5 rounded-2xl font-bold flex items-center gap-3 transition-all transform hover:scale-[1.02] shadow-xl shadow-primary/20">
                    <Terminal className="w-5 h-5" /> Integrate Now
                  </a>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-2 md:grid-cols-4 divide-x divide-black/5 border-y border-black/5 py-8"
              >
                {HERO_METRICS.map((m, i) => (
                  <div key={i} className="px-6 space-y-2 first:pl-0">
                    <div className="text-2xl md:text-3xl font-mono font-bold text-primary tracking-tighter">{m.value}</div>
                    <div className="text-[10px] uppercase tracking-widest text-foreground/40 font-bold">{m.label}</div>
                  </div>
                ))}
              </motion.div>
            </header>

            {/* 3. THE PROBLEM */}
            <section className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold text-secondary tracking-tight">Why standard JS parsing fails at scale.</h2>
                <div className="h-1 w-24 bg-red-500/20 rounded-full" />
              </div>
              <p className="text-lg text-foreground/70 leading-relaxed font-medium">
                Traditional libraries like <code className="bg-black/5 px-1.5 py-0.5 rounded text-sm font-mono border border-black/5">jsondiffpatch</code> load entire documents into the V8 heap.
                This triggers massive Garbage Collection pauses that kill 60fps UI threads and choke node.js streams.
              </p>

              {/* Visual Problem Indicator */}
              <div className="p-8 rounded-[2rem] bg-secondary/5 border border-secondary/10 relative overflow-hidden">
                <div className="space-y-6 relative z-10">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest opacity-60">
                    <span>V8 Heap Usage</span>
                    <span className="text-red-600">CRITICAL LOAD</span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-16 w-full bg-white rounded-xl border border-black/5 overflow-hidden flex items-end p-1 gap-1">
                      {[40, 60, 45, 90, 95, 100, 20, 30].map((h, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: "20%" }}
                          whileInView={{ height: `${h}%` }}
                          transition={{ delay: i * 0.05, duration: 0.5 }}
                          className={cn("flex-1 rounded-sm", h > 80 ? "bg-red-500" : "bg-primary/20")}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono text-red-600 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    ⚠ GC PAUSE DETECTED: 155ms LATENCY
                  </div>
                </div>
              </div>
            </section>

            {/* 4. ARCHITECTURE */}
            <section className="space-y-12">
              <div className="space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">The Silicon Path Pipeline</h2>
                <p className="text-foreground/60 max-w-2xl text-lg">
                  A straight line from raw bytes to structural diffs. No object allocation. No recursion.
                </p>
              </div>
              <ArchitectureDiagram />
            </section>

          </div>

          {/* RIGHT STICKY COLUMN */}
          <div className="hidden lg:block lg:col-span-1 pt-12">
            <div className="sticky top-24 space-y-8">
              <BenchmarkDemo />

              <div className="p-6 bg-surface rounded-2xl border border-black/5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest mb-4 opacity-50">Competitive Matrix</h3>
                <div className="space-y-2 text-sm">
                  {[
                    { name: "jsondiffpatch", time: "155ms", status: "Slow" },
                    { name: "deep-diff", time: "142ms", status: "Slow" },
                    { name: "DiffCore v2.2", time: "29ms", status: "Fast" }
                  ].map((c, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-background rounded-lg border border-black/5 text-xs">
                      <span className="font-bold text-foreground/80">{c.name}</span>
                      <span className={cn("font-mono font-bold", c.status === 'Fast' ? "text-accent" : "text-foreground/40")}>{c.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* 5. ENGINEERING PROOF (Mobile Only Fallback) */}
        <div className="lg:hidden space-y-12 mt-12">
          <BenchmarkDemo />
        </div>

        {/* 6. INTEGRATION (ONBOARDING) - FULL WIDTH */}
        <section id="onboarding" className="space-y-16 pt-12 border-t border-black/5">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Initialize in 3 Lines</h2>
            <p className="text-foreground/60 max-w-xl">Drop-in replacement for complex state engines. Get running in under 2 minutes.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {ONBOARDING_STEPS.map((step, i) => (
              <div key={i} className="group p-8 rounded-[2rem] bg-surface border border-black/10 hover:border-black/20 hover:shadow-xl hover:shadow-black/5 transition-all">
                <div className="w-10 h-10 rounded-2xl bg-black/5 flex items-center justify-center font-bold text-sm mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                  {i + 1}
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-xs text-foreground/50 mb-8 min-h-[32px] font-medium leading-relaxed">{step.desc}</p>
                <CodeBlock code={step.code} className="mt-0 text-[10px] border-none bg-black/80" />
              </div>
            ))}
          </div>

          {/* DETAILED PLATFORM TABS */}
          <div className="pt-20 border-t border-black/5">
            <div className="flex flex-col lg:flex-row gap-12 lg:gap-24">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                className="shrink-0"
              >
                <Navigation activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setActiveStep(0); }} />
              </motion.div>

              <div className="flex-1 space-y-8">
                <h3 className="text-2xl font-bold">Deep Dive Configurations</h3>
                {DOCS_CONTENT[activeTab as keyof typeof DOCS_CONTENT].map((step, i) => (
                  <Step
                    key={i}
                    number={i + 1}
                    title={step.title}
                    description={step.description}
                    code={step.code}
                    active={activeStep === i}
                    language="bash"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="pt-32 border-t border-black/10 flex flex-wrap justify-between gap-8 text-foreground/40 items-end">
          <div className="space-y-4 text-xs font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full" /> All Systems Operational</div>
            <div className="flex gap-8">
              <span>© 2026 DiffCore</span>
              <a href="#" className="hover:text-foreground">MIT License</a>
              <a href="#" className="hover:text-foreground">Documentation</a>
            </div>
          </div>

          <div className="text-[10px] sm:text-xs opacity-50 max-w-md text-right leading-relaxed">
            SIMD Enabled JSON Diff Engine. Zero-GC WebAssembly JSON Parser. High-Throughput Rust WASM Library.
            Deterministic JSON comparison for high-performance systems. Evaluted against jsondiffpatch, deep-diff, and jq.
          </div>
        </footer>
      </div>
    </main>
  );
}
