"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ContactResponse = {
  contact_id: string;
  routing: string;
};

export function ContactForm() {
  const [status, setStatus] = React.useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [receipt, setReceipt] = React.useState<ContactResponse | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setStatus("loading");
    setError(null);
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Contact form failed");
      }
      setReceipt(data as ContactResponse);
      setStatus("sent");
      formElement.reset();
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Contact form failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-caption font-semibold uppercase tracking-wider text-signal-600">
          Contact
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Send the team a message.</h2>
        <p className="mt-2 text-body-sm text-slate-600">
          Sales, support, partnerships, press, and security requests route from here.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">Name</Label>
          <Input id="contact-name" name="name" required placeholder="Your name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" name="email" type="email" required placeholder="you@business.com" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-company">Company</Label>
          <Input id="contact-company" name="company" placeholder="Company name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-topic">Topic</Label>
          <select
            id="contact-topic"
            name="topic"
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-body-sm text-slate-900 focus:border-signal-500 focus:outline-none focus:ring-2 focus:ring-signal-100"
            defaultValue="sales"
          >
            <option value="sales">Sales</option>
            <option value="support">Support</option>
            <option value="agency">Agency / white label</option>
            <option value="security">Security</option>
            <option value="press">Press</option>
          </select>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="contact-message">Message</Label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          placeholder="Tell us what you need."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-body-sm text-slate-900 focus:border-signal-500 focus:outline-none focus:ring-2 focus:ring-signal-100"
        />
      </div>

      {error ? <p className="mt-3 text-body-sm text-error-600">{error}</p> : null}
      {status === "sent" && receipt ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-success-500/20 bg-success-500/10 p-3 text-body-sm text-slate-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-600" />
          <span>
            Message received. Ticket {receipt.contact_id} routed to {receipt.routing}.
          </span>
        </div>
      ) : null}

      <Button type="submit" size="lg" className="mt-5 w-full" loading={status === "loading"}>
        Send message <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
