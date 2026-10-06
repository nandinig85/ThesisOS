import { NextResponse } from "next/server";
import { runThesisSearch } from "@/lib/serpapi";
import type { ThesisInput } from "@/lib/types";

export const runtime = "nodejs";

function field(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "Enter a valid thesis." }, { status: 400 }); }
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const input: ThesisInput = {
    sector: field(data.sector, 100), geography: field(data.geography, 80),
    stage: field(data.stage, 80), thesis: field(data.thesis, 400),
  };
  if (!input.sector || !input.geography || !input.stage) {
    return NextResponse.json({ error: "Sector, geography, and investment stage are required." }, { status: 400 });
  }
  try {
    return NextResponse.json(await runThesisSearch(input));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";
    const missingKey = message.startsWith("SERPAPI_API_KEY is missing");
    return NextResponse.json({ error: message }, { status: missingKey ? 503 : 502 });
  }
}
