"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Program } from "@/types/database";

const MY_PROGRAM_VALUE = "__my_program__";

export function ProgramSwitcher() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [currentOverrideId, setCurrentOverrideId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [programsRes, overrideRes] = await Promise.all([
        fetch("/api/admin/programs"),
        fetch("/api/admin/program-override"),
      ]);
      if (programsRes.ok) setPrograms(await programsRes.json());
      if (overrideRes.ok) {
        const data = await overrideRes.json();
        setCurrentOverrideId(data.programId);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  async function handleChange(value: string) {
    setSwitching(true);
    let res: Response;
    if (value === MY_PROGRAM_VALUE) {
      res = await fetch("/api/admin/program-override", { method: "DELETE" });
    } else {
      res = await fetch("/api/admin/program-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: value }),
      });
    }
    if (!res.ok) {
      setSwitching(false);
      return;
    }
    // Full reload is required: client-side hooks (useRecruits, useQueue, etc.)
    // are mount-only fetchers that router.refresh() does not remount.
    window.location.reload();
  }

  if (loading) return null;
  if (!currentOverrideId && programs.length < 2) return null;

  const isOverrideActive = currentOverrideId !== null;

  // Override active but programs list unavailable — render minimal reset so admin isn't trapped.
  if (isOverrideActive && programs.length < 2) {
    return (
      <div className="px-3 mt-1">
        <p className="text-xs text-muted-foreground mb-1.5 px-1">Viewing as</p>
        <button
          onClick={() => handleChange(MY_PROGRAM_VALUE)}
          disabled={switching}
          className="w-full text-xs h-8 rounded-md border border-amber-500/50 text-amber-600 dark:text-amber-400 px-2 text-left hover:bg-accent disabled:opacity-50"
        >
          Reset to My Program
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 mt-1">
      <p className="text-xs text-muted-foreground mb-1.5 px-1">Viewing as</p>
      <Select
        value={currentOverrideId ?? ""}
        onValueChange={handleChange}
        disabled={switching}
      >
        <SelectTrigger
          className={`w-full text-xs h-8 ${isOverrideActive ? "border-amber-500/50 text-amber-600 dark:text-amber-400" : ""}`}
        >
          <SelectValue placeholder="Select program…" />
        </SelectTrigger>
        <SelectContent>
          {programs.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
