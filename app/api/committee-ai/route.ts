import { NextResponse } from "next/server";
import { generateAICommittee } from "@/lib/ai-mode";
import type { CommitteeContext } from "@/lib/committee-prompts";
import type { EvidenceStatus, ThesisInput } from "@/lib/types";

export const runtime = "nodejs";

const field = (value: unknown, max: number) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown, max: number) => Array.isArray(value) ? value.slice(0, max).map(record) : [];
const status = (value: unknown): EvidenceStatus => value === "confirmed" || value === "inferred" ? value : "unavailable";

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "Enter a valid thesis." }, { status: 400 }); }
  const data = record(raw);
  const thesis = record(data.thesis);
  const input: ThesisInput = {
    sector: field(thesis.sector, 100), geography: field(thesis.geography, 80),
    stage: field(thesis.stage, 80), thesis: field(thesis.thesis, 400),
  };
  if (!input.sector || !input.geography || !input.stage) return NextResponse.json({ error: "Sector, geography, and stage are required." }, { status: 400 });
  const context: CommitteeContext = {
    thesis: input,
    evidence: list(data.evidence, 160).map(item => ({ id: field(item.id, 100), domain: field(item.domain, 120) })),
    startups: list(data.startups, 8).map(item => ({ name: field(item.name, 100), funding: field(item.funding, 120), fundingStatus: status(item.fundingStatus), geographyStatus: status(item.geographyStatus) })),
    developments: list(data.developments, 8).map(item => ({ title: field(item.title, 200), category: field(item.category, 40), evidenceId: field(item.evidenceId, 100) })),
    risks: list(data.risks, 5).map(item => ({ title: field(item.title, 200), evidenceId: field(item.evidenceId, 100) })),
  };
  try { return NextResponse.json(await generateAICommittee(context)); }
  catch (error) {
    const message = error instanceof Error ? error.message : "AI Mode failed.";
    return NextResponse.json({ error: message }, { status: message.startsWith("SERPAPI_API_KEY is missing") ? 503 : 502 });
  }
}
