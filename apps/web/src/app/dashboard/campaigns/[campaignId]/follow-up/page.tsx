/**
 * Follow-Up tab — sequence editor split into Email + SMS columns.
 *
 * Each FollowupSequence row carries a `channel` and a list of `steps`
 * (timing + subject + body). The editor lets the user reorder, regenerate,
 * or add steps, then approve the whole sequence.
 */
import { notFound, redirect } from "next/navigation";

import { withWorkspaceContext } from "@funnel/db";
import { getCurrentSession } from "@/lib/auth/current-user";

import { SectionHeading, EmptyCard } from "../_shared/state";
import { FollowupEditor } from "../_clients/FollowupEditor.client";

export const metadata = { title: "Follow-Up | GoFunnelAI" };

const TIMING_LABEL: Record<string, string> = {
  immediate: "Immediately",
  day1: "Day 1",
  day3: "Day 3",
  day7: "Day 7",
  no_show: "No-show",
  reactivation: "Reactivation",
};

export default async function FollowupPage({ params }: { params: { campaignId: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const campaign = await withWorkspaceContext(session.workspace.id, async (tx) =>
    tx.campaign.findFirst({
      where: { id: params.campaignId, archivedAt: null },
      include: {
        followupSequences: { orderBy: [{ channel: "asc" }, { createdAt: "desc" }] },
      },
    }),
  );
  if (!campaign) notFound();

  const email = campaign.followupSequences.find((s) => s.channel === "email");
  const sms = campaign.followupSequences.find((s) => s.channel === "sms");

  function shape(s: typeof email): {
    id: string | null;
    status: string;
    steps: Array<{
      timing: string;
      timingLabel: string;
      subject: string | null;
      body: string;
    }>;
  } {
    if (!s) {
      return { id: null, status: "draft", steps: [] };
    }
    const steps = Array.isArray(s.steps) ? (s.steps as Array<Record<string, unknown>>) : [];
    return {
      id: s.id,
      status: s.status,
      steps: steps.map((st) => ({
        timing: String(st.timing ?? "immediate"),
        timingLabel: TIMING_LABEL[String(st.timing ?? "immediate")] ?? String(st.timing),
        subject: typeof st.subject === "string" ? st.subject : null,
        body: typeof st.body === "string" ? st.body : "",
      })),
    };
  }

  const emailData = shape(email);
  const smsData = shape(sms);

  if (!email && !sms) {
    return (
      <div className="space-y-5">
        <SectionHeading
          title="Follow-Up"
          description="Lead nurturing across email + SMS."
        />
        <EmptyCard
          title="No sequences yet"
          description="Follow-up sequences are drafted once the plan is approved."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Follow-Up"
        description="Email and SMS nurture sequences. Reorder, regenerate, or approve the whole flow."
      />
      <FollowupEditor
        campaignId={campaign.id}
        email={emailData}
        sms={smsData}
      />
    </div>
  );
}
