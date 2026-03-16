"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Activity, ShieldAlert, Crosshair, Search } from "lucide-react";

export type DecisionType = "monitor" | "investigate" | "escalate" | "review";

interface DecisionBadgeProps {
  type: DecisionType;
  className?: string;
}

export function DecisionBadge({ type, className }: DecisionBadgeProps) {
  const config = {
    monitor: {
      label: "Monitor",
      icon: Activity,
      classes: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    },
    investigate: {
      label: "Investigate",
      icon: Search,
      classes: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    escalate: {
      label: "Escalate",
      icon: ShieldAlert,
      classes: "bg-red-500/10 text-red-400 border-red-500/20",
    },
    review: {
      label: "Review",
      icon: Crosshair,
      classes: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    }
  };

  const { label, icon: Icon, classes } = config[type] || config.monitor;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-widest",
        classes,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
