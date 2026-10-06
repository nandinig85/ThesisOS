import "server-only";
import { parseAIMode } from "./ai-mode-extract";
import { buildChairPrompt, buildRolePrompt } from "./committee-prompts";
import type { CommitteeContext } from "./committee-prompts";
import type { AICommitteeRun, AIVoice, CommitteeVoice } from "./types";

const roles: CommitteeVoice["role"][] = ["Market", "Bull", "Bear", "Regulatory"];

function countryCode(geography: string): string | undefined {
  const value = geography.trim().toLowerCase();
  return ({ india: "in", "united states": "us", usa: "us", uk: "uk", "united kingdom": "uk", canada: "ca", germany: "de", france: "fr", australia: "au", singapore: "sg" } as Record<string, string>)[value];
}

async function askAIMode(run: CommitteeContext, role: CommitteeVoice["role"] | "Chair", query: string, key: string): Promise<AIVoice> {
  const params = new URLSearchParams({ engine: "google_ai_mode", q: query, hl: "en", api_key: key, output: "json" });
  const gl = countryCode(run.thesis.geography);
  if (gl) params.set("gl", gl);
  const response = await fetch(`https://serpapi.com/search.json?${params}`, { cache: "no-store", signal: AbortSignal.timeout(50000) });
  if (!response.ok) throw new Error(`SerpApi returned HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (payload && typeof payload === "object" && "error" in payload) throw new Error(String(payload.error));
  const parsed = parseAIMode(payload, role);
  if (!parsed) throw new Error("AI Mode returned no usable answer");
  return parsed;
}

export async function generateAICommittee(run: CommitteeContext): Promise<AICommitteeRun> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new Error("SERPAPI_API_KEY is missing. Add it to .env.local and restart the server.");
  const results = await Promise.allSettled(roles.map(role => askAIMode(run, role, buildRolePrompt(run, role), key)));
  const voices: AIVoice[] = [];
  const warnings: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") voices.push(result.value);
    else warnings.push(`${roles[index]}: ${result.reason instanceof Error ? result.reason.message : "AI Mode failed"}`);
  });
  if (!voices.length) throw new Error(`Google AI Mode could not generate perspectives. ${warnings.join(" ")}`);
  let chair: AIVoice | undefined;
  if (voices.length >= 2) {
    try { chair = await askAIMode(run, "Chair", buildChairPrompt(run, voices), key); }
    catch (error) { warnings.push(`Chair: ${error instanceof Error ? error.message : "AI Mode failed"}`); }
  } else warnings.push("Chair needs at least two available perspectives.");
  return { generatedAt: new Date().toISOString(), voices, chair, warnings };
}
