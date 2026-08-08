"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { motion } from "framer-motion";
import {
  CircleDot,
  GripHorizontal,
  LayoutGrid,
  Radar as RadarIcon,
  Scissors,
  Table as TableIcon,
  TrendingUp,
} from "lucide-react";

import { useAppStore } from "@/lib/store";
import { TopBar } from "@/components/app/top-bar";
import { ErrorBoundary } from "@/components/app/error-boundary";
import { FormulationTab } from "@/components/app/tabs/formulation-tab";
import { TestTab } from "@/components/app/tabs/test-tab";
import { SummaryTab } from "@/components/app/tabs/summary-tab";
import { RadarTab } from "@/components/app/tabs/radar-tab";
import { OffscreenChartRenderer } from "@/components/app/charts/offscreen-chart-renderer";
import type { TestType } from "@/lib/types";
import { cn } from "@/lib/utils";

type TabId =
  | "formulation"
  | "stress"
  | "puncture"
  | "tear"
  | "cling"
  | "summary"
  | "radar";

interface TabDef {
  id: TabId;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { id: "formulation", label: "Formulation", icon: LayoutGrid },
  { id: "stress", label: "Stress-Strain", icon: TrendingUp },
  { id: "puncture", label: "Puncture", icon: CircleDot },
  { id: "tear", label: "Tear", icon: Scissors },
  { id: "cling", label: "Cling", icon: GripHorizontal },
  { id: "radar", label: "Radar Chart", icon: RadarIcon },
  { id: "summary", label: "Summary", icon: TableIcon },
];

// Map TabId → TestType for the test-type tabs
function tabIdToTestType(id: TabId): TestType {
  return id as TestType;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabId>("stress");
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const density = useAppStore((s) => s.density);
  const setDensity = useAppStore((s) => s.setDensity);
  const addFormulationRow = useAppStore((s) => s.addFormulationRow);

  // Apply density data attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  // Ensure at least one formulation row exists on first mount
  useEffect(() => {
    const state = useAppStore.getState();
    if (state.formulation.rows.length === 0) {
      addFormulationRow();
    }
  }, [addFormulationRow]);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setSidebarCollapsed]);

  const cycleDensity = () => {
    const order: Array<"comfortable" | "cozy" | "compact"> = [
      "comfortable",
      "cozy",
      "compact",
    ];
    const idx = order.indexOf(density);
    setDensity(order[(idx + 1) % order.length]);
  };

  const mainContent = useMemo(() => {
    return (
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-4"
      >
        {activeTab === "formulation" ? (
          <FormulationTab />
        ) : activeTab === "summary" ? (
          <SummaryTab />
        ) : activeTab === "radar" ? (
          <RadarTab />
        ) : (
          <TestTab testType={tabIdToTestType(activeTab)} />
        )}
      </motion.div>
    );
  }, [activeTab]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            "hidden lg:flex flex-col border-r border-border bg-sidebar transition-[width] duration-200",
            sidebarCollapsed ? "w-16" : "w-60",
          )}
        >
          <nav className="flex-1 overflow-y-auto p-2">
            <p
              className={cn(
                "px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground-subtle",
                sidebarCollapsed && "sr-only",
              )}
            >
              Tests
            </p>
            <ul className="space-y-0.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                // Compute data count for the badge
                let count = 0;
                const ds = useAppStore.getState().datasets;
                if (tab.id === "formulation") {
                  count = useAppStore.getState().formulation.rows.length;
                } else if (tab.id === "stress") {
                  count = (ds.stress.reference ? 1 : 0) + ds.stress.comparisons.filter(Boolean).length;
                } else if (tab.id === "puncture") {
                  count = (ds.puncture.reference ? 1 : 0) + ds.puncture.comparisons.filter(Boolean).length;
                } else if (tab.id === "tear") {
                  count = (ds.tear.reference ? 1 : 0) + ds.tear.comparisons.filter(Boolean).length;
                } else if (tab.id === "cling") {
                  count = (ds.cling.reference ? 1 : 0) + ds.cling.comparisons.filter(Boolean).length;
                } else if (tab.id === "summary" || tab.id === "radar") {
                  count = ["stress", "puncture", "tear", "cling"].reduce(
                    (acc, tt) => acc + (ds[tt as keyof typeof ds].reference ? 1 : 0) + ds[tt as keyof typeof ds].comparisons.filter(Boolean).length,
                    0,
                  );
                }
                return (
                  <li key={tab.id}>
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors press",
                        isActive
                          ? "bg-primary-subtle text-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        sidebarCollapsed && "justify-center px-0",
                      )}
                      title={tab.label}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!sidebarCollapsed ? (
                        <>
                          <span className="truncate flex-1 text-left">{tab.label}</span>
                          {count > 0 && (
                            <span className={cn(
                              "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                              isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                            )}>
                              {count}
                            </span>
                          )}
                        </>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer: density toggle */}
          <div className="border-t border-sidebar-border p-2">
            <button
              onClick={cycleDensity}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-xs text-sidebar-foreground hover:bg-sidebar-accent",
                sidebarCollapsed && "justify-center px-0",
              )}
              title={`Density: ${density}`}
            >
              <LayoutGrid className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed ? (
                <span className="capitalize">{density}</span>
              ) : null}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1440px] p-4 sm:p-6">
            <ErrorBoundary>
              {mainContent}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Offscreen chart renderer — always mounted so exports can capture any chart */}
      <ErrorBoundary>
        <OffscreenChartRenderer active />
      </ErrorBoundary>
    </div>
  );
}
