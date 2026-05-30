"use client";

/**
 * Cockpit mutation client.
 *
 * Thin wrappers over the tRPC `launch.*` mutations exposed by the api
 * server. The wrappers all share a single `call()` helper so we get
 * uniform error handling, optimistic loading state, and the conventional
 * `router.refresh()` after success (server components do the re-fetch).
 *
 * We intentionally never echo backend agent names ("audience-targeting
 * agent v1.2") in errors — the surface here is a stable, branded vocabulary:
 * "Audience updated", "Couldn't regenerate copy", etc.
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface CallOptions {
  successMessage?: string;
}

async function call(path: string, body: unknown): Promise<void> {
  const res = await fetch(`/api/launch${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Something went wrong");
  }
}

export function useLaunchMutation() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(path: string, body: unknown, _opts: CallOptions = {}) {
    return new Promise<void>((resolve, reject) => {
      start(async () => {
        try {
          await call(path, body);
          router.refresh();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  return { run, pending };
}
