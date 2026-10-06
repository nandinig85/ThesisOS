import { NextResponse } from "next/server";
import { researchCompany } from "@/lib/serpapi";

export const runtime = "nodejs";

const field = (value: unknown, max: number) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "Enter a valid company." }, { status: 400 }); }
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const name = field(data.name, 80);
  const sector = field(data.sector, 100);
  const geography = field(data.geography, 80);
  if (!name || !sector || !geography) return NextResponse.json({ error: "Company, sector, and geography are required." }, { status: 400 });
  try { return NextResponse.json(await researchCompany(name, sector, geography)); }
  catch (error) {
    const message = error instanceof Error ? error.message : "Company research failed.";
    return NextResponse.json({ error: message }, { status: message.startsWith("SERPAPI_API_KEY is missing") ? 503 : 502 });
  }
}
