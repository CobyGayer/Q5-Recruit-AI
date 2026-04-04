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
      name: { label: "Name" },
      email: { label: "Email" },
      phone: { label: "Phone" },
      graduationYear: { label: "Graduation Year" },
      positions: { label: "Position(s)" },
    },
  },
  physical: {
    label: "Physical Attributes",
    columns: {
      height: { label: "Height" },
      weight: { label: "Weight" },
      preferredFoot: { label: "Preferred Foot" },
    },
  },
  academic: {
    label: "Academic Scores",
    columns: {
      gpa: { label: "GPA" },
      satScore: { label: "SAT Score" },
      actScore: { label: "ACT Score" },
    },
  },
  athletic: {
    label: "Athletic Background",
    columns: {
      clubTeam: { label: "Club Team" },
      clubLevel: { label: "Club Level" },
      highSchool: { label: "High School Team" },
      videoUrl: { label: "Video URL" },
    },
  },
  location: {
    label: "Location",
    columns: {
      currentSchool: { label: "Current School" },
      city: { label: "City" },
      state: { label: "State" },
      country: { label: "Country" },
    },
  },
  dqs: {
    label: "DQS Scoring",
    columns: {
      dqsScore: { label: "Overall DQS Score" },
      qualified: { label: "Qualified (Yes/No)" },
      academicScore: { label: "Academic Score" },
      competitionScore: { label: "Competition Score" },
      physicalScore: { label: "Physical Score" },
      positionFitScore: { label: "Position Fit Score" },
      gradYearScore: { label: "Grad Year Score" },
      completenessScore: { label: "Completeness Score" },
      disqualificationReasons: { label: "Disqualification Reasons" },
    },
  },
  quality: {
    label: "Data Quality",
    columns: {
      completeness: { label: "Data Completeness %" },
      fieldsExtracted: { label: "Fields Extracted Count" },
      fieldsTotal: { label: "Fields Total Count" },
    },
  },
  status: {
    label: "Status & Flags",
    columns: {
      flag: { label: "Flag (Interested/Not a Fit)" },
      createdDate: { label: "Date Added" },
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

  const [selectedColumns, setSelectedColumns] = useState<SelectedColumns>(() => {
    const selected: SelectedColumns = {};
    Object.entries(COLUMN_GROUPS).forEach(([, group]) => {
      Object.entries(group.columns).forEach(([key]) => {
        selected[key] = true;
      });
    });
    return selected;
  });

  const totalColumns = Object.values(COLUMN_GROUPS).reduce(
    (sum, group) => sum + Object.keys(group.columns).length,
    0
  );

  function selectAll() {
    const allSelected: SelectedColumns = {};
    Object.entries(COLUMN_GROUPS).forEach(([, group]) => {
      Object.entries(group.columns).forEach(([key]) => {
        allSelected[key] = true;
      });
    });
    setSelectedColumns(allSelected);
  }

  function deselectAll() {
    const noneSelected: SelectedColumns = {};
    Object.entries(COLUMN_GROUPS).forEach(([, group]) => {
      Object.entries(group.columns).forEach(([key]) => {
        noneSelected[key] = false;
      });
    });
    setSelectedColumns(noneSelected);
  }

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
                <Button variant="ghost" size="sm" onClick={selectedCount === totalColumns ? deselectAll : selectAll} className="h-7 text-xs">
                  {selectedCount === totalColumns ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">{selectedCount}/{totalColumns} columns selected</p>

              <div className="space-y-2 bg-muted/30 rounded-lg p-3">
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
