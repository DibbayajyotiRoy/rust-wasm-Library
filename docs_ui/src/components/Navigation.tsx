"use client";

import { motion } from "framer-motion";
import { Globe, Smartphone, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const tabs = [
    { id: "web", label: "Web (WASM + JavaScript)", icon: Globe },
    { id: "mobile", label: "Mobile (Native / FFI)", icon: Smartphone },
    { id: "desktop", label: "Desktop (Rust / Electron / Tauri)", icon: Monitor },
];

export function Navigation({ activeTab, setActiveTab }: NavProps) {
    return (
        <div className="flex flex-col gap-2 w-full md:w-64">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-3 p-4 rounded-xl text-sm font-medium transition-all",
                            isActive
                                ? "bg-primary text-background shadow-lg shadow-primary/20"
                                : "text-foreground/40 hover:text-foreground hover:bg-white/5"
                        )}
                    >
                        <Icon className="w-5 h-5" />
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
