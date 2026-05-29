"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../primitives/dialog";
import { Button } from "../primitives/button";
import { Textarea } from "../primitives/textarea";
import { ImagePlus, RefreshCw, Scissors, Sparkles, Type } from "lucide-react";
import type { EditAction } from "./FunnelPreviewRenderer";

export interface SectionEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string | null;
  sectionType?: string;
  initialAction?: EditAction;
  /** Called when the user submits an instruction to the AI. */
  onSubmit?: (args: { sectionId: string; action: EditAction; instruction: string }) => void;
}

const QUICK_ACTIONS: Array<{ id: EditAction; label: string; icon: React.ReactNode; hint: string }> = [
  { id: "regenerate", label: "Regenerate", icon: <RefreshCw className="h-4 w-4" />, hint: "Re-generate this section from scratch with a fresh angle." },
  { id: "edit-copy", label: "Edit copy", icon: <Type className="h-4 w-4" />, hint: "Rewrite the headline, subhead, and body copy." },
  { id: "swap-image", label: "Swap image", icon: <ImagePlus className="h-4 w-4" />, hint: "Generate a new visual that matches the section." },
  { id: "make-shorter", label: "Make shorter", icon: <Scissors className="h-4 w-4" />, hint: "Trim the section by 30-50% without losing the point." },
];

/**
 * AI-guided edit dialog. Surfaces a row of quick actions plus a freeform
 * instruction box. The host page wires the submit callback to its
 * regeneration endpoint.
 */
export function SectionEditDialog({ open, onOpenChange, sectionId, sectionType, initialAction = "open", onSubmit }: SectionEditDialogProps): JSX.Element {
  const [action, setAction] = React.useState<EditAction>(initialAction);
  const [instruction, setInstruction] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setAction(initialAction);
      setInstruction("");
    }
  }, [open, initialAction]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-signal-600" />
            Edit section
          </DialogTitle>
          <DialogDescription>
            {sectionType ? <span className="font-mono text-caption text-slate-500">{sectionType}</span> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.id}
                type="button"
                onClick={() => setAction(qa.id)}
                className={[
                  "flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-caption font-semibold transition",
                  action === qa.id
                    ? "border-signal-500 bg-signal-50 text-signal-700"
                    : "border-slate-200 text-slate-700 hover:border-signal-300 hover:bg-slate-50",
                ].join(" ")}
              >
                {qa.icon}
                {qa.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="ai-instruction" className="mb-1 block text-body-sm font-semibold text-slate-900">
              Tell GoFunnelAI what to change
            </label>
            <Textarea
              id="ai-instruction"
              rows={4}
              placeholder={QUICK_ACTIONS.find((q) => q.id === action)?.hint ?? "e.g. make it punchier and add a specific number"}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <p className="mt-1 text-caption text-slate-500">Edits are versioned. You can revert any change from the section history.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!sectionId) return;
              onSubmit?.({ sectionId, action, instruction });
              onOpenChange(false);
            }}
            disabled={!sectionId}
          >
            <Sparkles className="h-4 w-4" />
            Apply with AI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
