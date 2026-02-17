"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function FeedbackDialog() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit() {
    if (!message.trim()) return;

    setStatus("sending");
    setErrorMessage("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("success");
      setMessage("");

      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 1500);
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to send feedback"
      );
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setStatus("idle");
      setErrorMessage("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-muted-foreground hover:bg-muted/50 hover:text-foreground w-full"
        >
          <MessageSquare className="h-4 w-4" />
          Feedback
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Share your thoughts, report bugs, or suggest improvements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="feedback-message">Message</Label>
          <Textarea
            id="feedback-message"
            placeholder="What's on your mind?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={5}
            disabled={status === "sending" || status === "success"}
          />
          <p className="text-xs text-muted-foreground text-right">
            {message.length}/2000
          </p>
        </div>

        {status === "success" && (
          <p className="text-sm text-green-600">Feedback sent! Thank you.</p>
        )}

        {status === "error" && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={
              !message.trim() || status === "sending" || status === "success"
            }
          >
            {status === "sending" ? "Sending..." : "Send Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
