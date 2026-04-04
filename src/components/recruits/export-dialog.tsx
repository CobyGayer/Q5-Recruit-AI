"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  recruitCount: number;
}

type ExportFormat = "excel" | "csv";

// Define available columns for CSV export
const COLUMN_GROUPS = {
  basic: {
    label: "Basic Information",
    columns: {
      name: { label: "Name", default: true },
      email: { label: "Email", default: true },
      phone: { label: "Phone", default: false },
      graduationYear: { label: "Graduation Year", default: true },
      positions: { label: "Position(s)", default: true },
    },
  },
  physical: {
    label: "Physical Attributes",
    columns: {
      height: { label: "Height", default: true },
      weight: { label: "Weight", default: false },
      preferredFoot: { label: "Preferred Foot", default: false },
    },
  },
  academic: {
    label: "Academic Scores",
    columns: {
      gpa: { label: "GPA", default: true },
      satScore: { label: "SAT Score", default: true },
      actScore: { label: "ACT Score", default: true },
    },
  },
  athletic: {
    label: "Athletic Background",
    columns: {
      clubTeam: { label: "Club Team", default: true },
      clubLevel: { label: "Club Level", default: true },
      highSchool: { label: "High School Team", default: false },
      videoUrl: { label: "Video URL", default: false },
    },
  },
  location: {
    label: "Location",
    columns: {
      currentSchool: { label: "Current School", default: false },
      city: { label: "City", default: false },
      state: { label: "State", default: false },
      country: { label: "Country", default: false },
    },
  },
  dqs: {
    label: "DQS Scoring",
    columns: {
      dqsScore: { label: "Overall DQS Score", default: true },
      qualified: { label: "Qualified (Yes/No)", default: true },
      academicScore: { label: "Academic Score", default: false },
      competitionScore: { label: "Competition Score", default: false },
      physicalScore: { label: "Physical Score", default: false },
      positionFitScore: { label: "Position Fit Score", default: false },
      gradYearScore: { label: "Grad Year Score", default: false },
      completenessScore: { label: "Completeness Score", default: false },
      disqualificationReasons: { label: "Disqualification Reasons", default: false },
    },
  },
  quality: {
    label: "Data Quality",
    columns: {
      completeness: { label: "Data Completeness %", default: true },
      fieldsExtracted: { label: "Fields Extracted Count", default: false },
      fieldsTotal: { label: "Fields Total Count", default: false },
    },
  },
  status: {
    label: "Status & Flags",
    columns: {
      flag: { label: "Flag (Interested/Not a Fit)", default: false },
      createdDate: { label: "Date Added", default: false },
    },
  },
};

type SelectedColumns = Record<string, boolean>;

export function ExportDialog({ open, onClose, recruitCount }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("excel");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    basic: false,
    physical: false,
    academic: false,
    athletic: false,
    location: false,
    dqs: false,
    quality: false,
    status: false,
  });

  // Initialize selected columns based on defaults
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumns>(() => {
    const selected: SelectedColumns = {};
    Object.entries(COLUMN_GROUPS).forEach(([, group]) => {
      Object.entries(group.columns).forEach(([key, col]) => {
        selected[key] = col.default;
      });
    });
    return selected;
  });

  function toggleGroup(groupKey: string) {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }

  function toggleColumn(columnKey: string) {
    setSelectedColumns((prev) => ({
      ...prev,
      [columnKey]: !prev[columnKey],
    }));
  }

  function selectAllInGroup(groupKey: string) {
    const group = COLUMN_GROUPS[groupKey as keyof typeof COLUMN_GROUPS];
    if (!group) return;
    const allSelected = Object.keys(group.columns).every((key) => selectedColumns[key]);
    setSelectedColumns((prev) => ({
      ...prev,
      ...Object.fromEntries(
        Object.keys(group.columns).map((key) => [key, !allSelected])
      ),
    }));
  }

  const selectedCount = Object.values(selectedColumns).filter(Boolean).length;

  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleExport() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/recruits/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          selectedColumns,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Export failed");
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `recruits.${format === "excel" ? "xlsx" : "csv"}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match) filename = match[1];
      }

      // Download file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Recruits</DialogTitle>
          <DialogDescription>
            Download data for {recruitCount} recruit{recruitCount !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Export Format</Label>
            <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">
                  <div>
                    <div className="font-medium">Excel (.xlsx)</div>
                    <div className="text-xs text-muted-foreground">
                      Formatted with styling and summary sheet
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="csv">
                  <div>
                    <div className="font-medium">CSV (.csv)</div>
                    <div className="text-xs text-muted-foreground">
                      Plain text, universally compatible
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Column Selection */}
          <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Columns to Include</Label>
                  <p className="text-xs text-muted-foreground">Applies to both Excel and CSV formats</p>
                </div>
                <p className="text-xs text-muted-foreground">{selectedCount} selected</p>
              </div>

              <div className="space-y-2 bg-muted/30 rounded-lg p-3 max-h-96 overflow-y-auto">
                {Object.entries(COLUMN_GROUPS).map(([groupKey, group]) => {
                  const isExpanded = expandedGroups[groupKey];
                  const groupColumns = Object.entries(group.columns);
                  const allSelected = groupColumns.every(([key]) => selectedColumns[key]);

                  return (
                    <div key={groupKey} className="border-b last:border-b-0 pb-2 last:pb-0">
                      {/* Group Header */}
                      <div className="flex items-center gap-2 py-2 cursor-pointer hover:bg-muted/50 px-2 rounded">
                        <button
                          onClick={() => toggleGroup(groupKey)}
                          className="flex-shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => selectAllInGroup(groupKey)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-shrink-0"
                        />
                        <label
                          className="flex-1 font-medium text-sm cursor-pointer"
                          onClick={() => toggleGroup(groupKey)}
                        >
                          {group.label}
                        </label>
                        <span className="text-xs text-muted-foreground">
                          {groupColumns.filter(([key]) => selectedColumns[key]).length}/
                          {groupColumns.length}
                        </span>
                      </div>

                      {/* Group Columns */}
                      {isExpanded && (
                        <div className="ml-6 space-y-2 pt-2">
                          {groupColumns.map(([columnKey, columnDef]) => (
                            <div
                              key={columnKey}
                              className="flex items-center gap-2"
                            >
                              <Checkbox
                                id={columnKey}
                                checked={selectedColumns[columnKey]}
                                onCheckedChange={() => toggleColumn(columnKey)}
                              />
                              <Label
                                htmlFor={columnKey}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {columnDef.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={loading || selectedCount === 0}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
