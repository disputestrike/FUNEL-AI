/**
 * GET /api/share/[shareCode]/og
 *
 * Renders the social-share OG card for an audit using @vercel/og. Cached at
 * the edge for 1 year â€” audit results are immutable.
 */

import { ImageResponse } from "@vercel/og";

import { prisma } from "@funnel/db";
import { isValidShareCode } from "@/lib/share-code";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;

function gradeColor(grade: string | null): string {
  if (!grade) return "#475569";
  if (grade.startsWith("A")) return "#16a34a";
  if (grade === "B") return "#22c55e";
  if (grade === "C") return "#f59e0b";
  if (grade === "D") return "#f97316";
  return "#dc2626";
}

export async function GET(_req: Request, { params }: { params: { shareCode: string } }) {
  if (!isValidShareCode(params.shareCode)) {
    return new Response("Not found", { status: 404 });
  }

  const share = await prisma.shareCode.findUnique({
    where: { code: params.shareCode },
    include: { audit: true },
  });
  if (!share) return new Response("Not found", { status: 404 });
  const a = share.audit;
  const score = a.scoreOverall ?? 0;
  const grade = a.scoreGrade ?? "â€”";
  const hostname = a.urlHostname;
  const critique = (a.critique ?? "").slice(0, 140);

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #f0f7ff 0%, #ffffff 60%, #e0eefe 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: "#0265c5",
              color: "white",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            F
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#0b0e14" }}>GoFunnelAI Grader</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div
            style={{
              width: 280,
              height: 280,
              borderRadius: 999,
              background: "white",
              border: `12px solid ${gradeColor(grade)}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 32px rgba(15, 130, 231, 0.2)",
            }}
          >
            <div style={{ fontSize: 120, fontWeight: 900, color: "#0b0e14", lineHeight: 1 }}>
              {score}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: gradeColor(grade), marginTop: 8 }}>
              Grade {grade}
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 38, fontWeight: 800, color: "#0b0e14", lineHeight: 1.1 }}>
              {hostname}
            </div>
            <div style={{ fontSize: 22, color: "#475569", lineHeight: 1.4 }}>
              {critique || "Free AI funnel audit â€” 5 sub-scores, 3 specific improvements."}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 20, color: "#0265c5", fontWeight: 600 }}>
          Grade your page free at gofunnelai.com/grade
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
