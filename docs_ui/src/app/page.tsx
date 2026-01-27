"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { Step } from "@/components/Step";
import { Zap, Cpu, Layers } from "lucide-react";
import { BenchmarkDemo } from "@/components/BenchmarkDemo";

const DOCS_CONTENT = {
  web: [
    {
      title: "Integrate via GitHub",
      description: "Import DiffCore directly as a GitHub dependency to ensure you have the latest Silicon Path optimizations. This bypasses registry delays and provides direct access to the raw WASM assets.",
      code: "bun add https://github.com/DibbayajyotiRoy/rust-wasm-Library\n# or\nnpm install https://github.com/DibbayajyotiRoy/rust-wasm-Library"
    },
    {
      title: "Initialize Engine Instance",
      description: "Load the WebAssembly binary and initialize the DiffCore engine with explicit memory bindings. This setup avoids runtime heap allocations, enabling deterministic, high-throughput diff execution at 817MB/s.",
      code: "import { DiffEngine } from './pkg/diffcore.js';\n\nconst engine = new DiffEngine(wasm, { computeMode: 'Throughput' });"
    },
    {
      title: "Execute Zero-GC Diff",
      description: "Stream raw bytes into the engine's linear memory. The unified single-pass parser will calculate structural differences without generating JavaScript garbage, suitable for real-time monitoring.",
      code: "const lp = engine.getLeftInputPtr();\nnew Uint8Array(wasm.memory.buffer, lp, b1.length).set(b1);\nengine.commitLeft(b1.length);\n\nconst diffs = engine.finalize();"
    }
  ],
  mobile: [
    {
      title: "Configure Git Submodule",
      description: "Add DiffCore as a git submodule in your native project. This ensures the Rust core can be compiled directly for ARM targets using the standard Android/iOS toolchains for maximum portability.",
      code: "git submodule add https://github.com/DibbayajyotiRoy/rust-wasm-Library\ncd rust-wasm-Library && cargo build --release --target aarch64-linux-android"
    },
    {
      title: "Map Symbolic Headers",
      description: "Include the C++ headers from the submodule in your native bridge (JSI or FFI). This allows your application to call the Silicon Path parser directly from native threads, bypassing JavaScript bridge latencies.",
      code: "#include \"rust-wasm-Library/cpp/include/parser.h\"\n#include \"rust-wasm-Library/cpp/include/engine.h\""
    },
    {
      title: "Bind Native Buffers",
      description: "Map native memory buffers to the DiffCore ingestion layer. Direct memory access enables high-speed comparison of large payloads on mobile devices without exhausting the main thread stack.",
      code: "auto engine = new silicon::Engine(config);\nengine->commit_left(nativeBuffer, length);\nauto result = engine->finalize();"
    }
  ],
  desktop: [
    {
      title: "Link Cargo Dependency",
      description: "Add the library as a direct git dependency in your `Cargo.toml`. This allows Rust-based desktop frameworks like Tauri to link the engine statically for peak performance and near-instant application startup.",
      code: "[dependencies]\ndiffcore = { git = \"https://github.com/DibbayajyotiRoy/rust-wasm-Library\" }"
    },
    {
      title: "Setup Shared Bus Memory",
      description: "Establish a high-speed shared memory bus between the native process and the UI layer. This architecture allows you to update large tree-view states in Electron apps with sub-30ms latency for 10MB+ JSON manifests.",
      code: "use diffcore::Engine;\n\nlet mut engine = Engine::new(config);\nengine.push_left(raw_bytes);"
    },
    {
      title: "Run Real-time Monitoring",
      description: "Deploy the engine to monitor configuration drift or state changes in large-scale desktop applications. The zero-allocation loop ensures sustained performance under heavy load.",
      code: "engine.watch(path).on('change', (diff) => {\n   app.dispatch({ type: 'UPDATE_STATE', diff });\n});"
    }
  ]
};

export default function Home() {
  const [activeTab, setActiveTab] = useState("web");
  const [activeStep, setActiveStep] = useState(0);

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <div className="max-w-7xl mx-auto px-6 py-20 lg:py-32">
        <header className="mb-20 space-y-8 max-w-4xl">
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 text-primary text-sm font-bold tracking-widest uppercase"
            >
              <Zap className="w-5 h-5 fill-primary" />
              High-Performance Rust & C++ WASM Library
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-6xl md:text-8xl font-black italic tracking-tighter leading-none"
            >
              DIFF<span className="text-primary/80">CORE</span>
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-primary/10 border-l-4 border-primary p-6 rounded-r-xl"
            >
              <p className="text-xl md:text-2xl font-medium leading-relaxed">
                A powerful WASM library built in Rust and C++ to make your development life easier.
                Optimize your JS data streaming, reduce computational costs, and achieve maximum browser efficiency
                with our zero-allocation engine.
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="grid md:grid-cols-2 gap-12 pt-12 border-t border-white/5"
          >
            <section className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-primary">Core Capabilities</h2>
                <div className="h-1 w-20 bg-primary/50 rounded-full" />
              </div>
              <ul className="space-y-4 text-foreground/80 list-none">
                {[
                  "Process >10MB JSON payloads in <20ms",
                  "Direct Memory Access (DMA) for Zero-Copy updates",
                  "Hybrid Rust & C++ Dual-Stack Architecture",
                  "128-bit SIMD Vector Acceleration",
                  "Deterministic memory usage (No GC pauses)"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm italic text-foreground/60 border-l-2 border-primary/30 pl-4 py-1">
                "Built for applications where 60 FPS is non-negotiable."
              </p>
            </section>

            <section className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-secondary">Architecture & Performance</h2>
                <div className="h-1 w-20 bg-secondary/50 rounded-full" />
              </div>
              <p className="text-foreground/70 font-medium text-sm">
                DiffCore replaces the V8 JSON parser with a <span className="text-foreground">custom SIMD pipeline</span>.
                While standard libraries (jsondiffpatch, deep-diff) rely on the garbage collector, we manage memory manually.
              </p>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4 text-[10px] md:text-xs uppercase tracking-widest font-bold border-b border-white/5 pb-2">
                  <div className="text-foreground/40">Standard JS</div>
                  <div className="text-secondary">DiffCore Runtime</div>
                </div>
                {[
                  ["Garbage Collected Heap", "Zero-Copy Arena Allocators"],
                  ["Sequential Object Parsing", "SIMD Parallel Stream Processing"],
                  ["JIT Warm-up Penalty", "Ahead-of-Time Compiled (WASM)"],
                  ["Main Thread Blocking", "Dual-Stack (Rust/C++) Worker"],
                  ["~150 MB/s Throughput", "Saturated 800 MB/s+"]
                ].map(([old, newTech], i) => (
                  <div key={i} className="grid grid-cols-2 gap-4 text-sm items-center">
                    <div className="text-foreground/40 line-through decoration-white/20 text-xs">{old}</div>
                    <div className="font-bold text-secondary">{newTech}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Benchmark Visualization */}
            <BenchmarkDemo />
          </motion.div>
        </header>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 mb-32">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="shrink-0"
          >
            <Navigation activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setActiveStep(0); }} />
          </motion.div>

          <div className="flex-1 space-y-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid gap-6"
              >
                {DOCS_CONTENT[activeTab as keyof typeof DOCS_CONTENT].map((step, i) => (
                  <div key={i} onClick={() => setActiveStep(i)} className="cursor-pointer">
                    <Step
                      number={i + 1}
                      title={step.title}
                      description={step.description}
                      code={step.code}
                      active={activeStep === i}
                    />
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>

            <footer className="pt-20 border-t border-white/5 flex flex-wrap gap-8">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-30 grayscale saturate-0">
                <Cpu className="w-4 h-4" />
                <span>SIMD Enabled</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-30 grayscale saturate-0">
                <Layers className="w-4 h-4" />
                <span>Zero GC</span>
              </div>

              {/* Hidden SEO text for search engine optimization */}
              <div className="w-full text-[1px] opacity-0 pointer-events-none select-none">
                SIMD Enabled JSON Diff Engine. Zero-GC WebAssembly JSON Parser. High-Throughput Rust WASM Library.
                Deterministic JSON comparison for high-performance systems.
              </div>
            </footer>
          </div>
        </div>
      </div>

      {/* Decorative Gradient */}
      <div className="fixed top-0 right-0 w-1/3 h-1/2 bg-primary/5 blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-0 w-1/4 h-1/3 bg-secondary/5 blur-[100px] pointer-events-none -z-10" />
    </main>
  );
}
