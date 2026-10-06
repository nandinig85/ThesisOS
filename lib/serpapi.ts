import "server-only";
import { assembleRun, normalizeResults } from "./extract";
import { buildCommittee } from "./committee";
import { buildCompanyFields } from "./company-extract";
import { normalizeJobs, normalizePatents, normalizeScholar, normalizeTrends } from "./signals";
import type { CompanyDeepDive, Evidence, SearchRun, ThesisInput } from "./types";

type SearchSpec = { label: string; engine: "search" | "news"; query: string };

async function serpRequest(params: URLSearchParams): Promise<unknown> {
  const response = await fetch(`https://serpapi.com/search.json?${params}`, {
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });
  if (!response.ok) throw new Error(`SerpApi returned HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (payload && typeof payload === "object" && "error" in payload) throw new Error(String(payload.error));
  return payload;
}

function countryCode(geography: string): string | undefined {
  const value = geography.trim().toLowerCase();
  return ({ india: "in", "united states": "us", usa: "us", uk: "uk", "united kingdom": "uk", canada: "ca", germany: "de", france: "fr", australia: "au", singapore: "sg" } as Record<string, string>)[value];
}

export function buildQueries(input: ThesisInput): SearchSpec[] {
  const context = `${input.sector} ${input.geography}`;
  return [
    { label: "Startup discovery", engine: "search", query: `${context} startup funding` },
    { label: "Company landscape", engine: "search", query: `${context} startups companies founders` },
    { label: "Market developments", engine: "news", query: `${context} funding market` },
    { label: "Policy and risks", engine: "news", query: `${context} regulation policy risk` },
  ];
}

async function search(spec: SearchSpec, geography: string, apiKey: string): Promise<Evidence[]> {
  const params = new URLSearchParams({
    engine: spec.engine === "news" ? "google_news" : "google",
    q: spec.query,
    api_key: apiKey,
    output: "json",
    hl: "en",
  });
  const gl = countryCode(geography);
  if (gl) params.set("gl", gl);
  if (spec.engine === "search") params.set("num", "10");
  return normalizeResults(await serpRequest(params), spec.engine, spec.query);
}

async function trendSearch(input: ThesisInput, apiKey: string) {
  const params = new URLSearchParams({ engine: "google_trends", q: input.sector, date: "today 12-m", data_type: "TIMESERIES", api_key: apiKey, output: "json" });
  const geo = countryCode(input.geography) || (/^[a-z]{2}$/i.test(input.geography) ? input.geography.toLowerCase() : undefined);
  if (!geo) throw new Error("Trends needs a recognized country name or two-letter country code");
  params.set("geo", geo.toUpperCase());
  return normalizeTrends(await serpRequest(params), input.sector, input.geography, geo);
}

async function jobsSearch(input: ThesisInput, apiKey: string) {
  const query = input.sector.replace(/^EV\s+/i, "").trim();
  const params = new URLSearchParams({ engine: "google_jobs", q: query, location: input.geography, hl: "en", api_key: apiKey, output: "json" });
  return normalizeJobs(await serpRequest(params), input.sector);
}

async function scholarSearch(input: ThesisInput, apiKey: string) {
  const params = new URLSearchParams({ engine: "google_scholar", q: `${input.sector} ${input.geography}`, hl: "en", as_ylo: String(new Date().getUTCFullYear() - 3), api_key: apiKey, output: "json" });
  return normalizeScholar(await serpRequest(params), input.sector);
}

async function patentsSearch(input: ThesisInput, apiKey: string) {
  const params = new URLSearchParams({ engine: "google_patents", q: input.sector, language: "ENGLISH", api_key: apiKey, output: "json" });
  return normalizePatents(await serpRequest(params), input.sector);
}

export async function runThesisSearch(input: ThesisInput): Promise<SearchRun> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new Error("SERPAPI_API_KEY is missing. Add it to .env.local and restart the server.");
  const specs = buildQueries(input);
  const trendPromise = trendSearch(input, key);
  const jobsPromise = jobsSearch(input, key);
  const scholarPromise = scholarSearch(input, key);
  const patentsPromise = patentsSearch(input, key);
  const results = await Promise.allSettled(specs.map(spec => search(spec, input.geography, key)));
  const [trendResult, jobsResult, scholarResult, patentsResult] = await Promise.allSettled([trendPromise, jobsPromise, scholarPromise, patentsPromise]);
  const evidence: Evidence[] = [];
  const warnings: string[] = [];
  const queries: SearchRun["queries"] = specs.map((spec, index) => {
    const result = results[index];
    if (result.status === "fulfilled") evidence.push(...result.value);
    else warnings.push(`${spec.label}: ${result.reason instanceof Error ? result.reason.message : "Search failed"}`);
    return { ...spec, ok: result.status === "fulfilled" };
  });
  queries.push({ label: "Search momentum", engine: "trends", query: input.sector, ok: trendResult.status === "fulfilled" });
  queries.push({ label: "Hiring signals", engine: "jobs", query: input.sector, ok: jobsResult.status === "fulfilled" });
  queries.push({ label: "Research publications", engine: "scholar", query: `${input.sector} ${input.geography}`, ok: scholarResult.status === "fulfilled" });
  queries.push({ label: "Patent landscape", engine: "patents", query: input.sector, ok: patentsResult.status === "fulfilled" });
  if (trendResult.status === "rejected") warnings.push(`Search momentum: ${trendResult.reason instanceof Error ? trendResult.reason.message : "Trends failed"}`);
  if (jobsResult.status === "rejected") warnings.push(`Hiring signals: ${jobsResult.reason instanceof Error ? jobsResult.reason.message : "Jobs failed"}`);
  if (scholarResult.status === "rejected") warnings.push(`Research publications: ${scholarResult.reason instanceof Error ? scholarResult.reason.message : "Scholar failed"}`);
  if (patentsResult.status === "rejected") warnings.push(`Patent landscape: ${patentsResult.reason instanceof Error ? patentsResult.reason.message : "Patents failed"}`);
  if (!queries.slice(0, specs.length).some(q => q.ok)) throw new Error(`All search and news queries failed. ${warnings.join(" ")}`);
  const run = assembleRun(input, evidence, queries, warnings);
  run.signals = {
    trend: trendResult.status === "fulfilled" ? trendResult.value : null,
    jobs: jobsResult.status === "fulfilled" ? jobsResult.value : [],
    papers: scholarResult.status === "fulfilled" ? scholarResult.value : [],
    patents: patentsResult.status === "fulfilled" ? patentsResult.value : [],
  };
  run.committee = buildCommittee(run);
  return run;
}

export async function researchCompany(name: string, sector: string, geography: string): Promise<CompanyDeepDive> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new Error("SERPAPI_API_KEY is missing. Add it to .env.local and restart the server.");
  const safeName = name.replace(/["“”]/g, "");
  const specs: SearchSpec[] = [
    { label: "Company profile", engine: "search", query: `"${safeName}" ${sector} ${geography} company funding founders` },
    { label: "Company news", engine: "news", query: `"${safeName}" ${sector}` },
  ];
  const results = await Promise.allSettled(specs.map(spec => search(spec, geography, key)));
  const evidence: Evidence[] = [];
  const warnings: string[] = [];
  for (let index = 0; index < specs.length; index++) {
    const result = results[index];
    if (result.status === "fulfilled") evidence.push(...result.value);
    else warnings.push(`${specs[index].label}: ${result.reason instanceof Error ? result.reason.message : "Search failed"}`);
  }
  if (!results.some(result => result.status === "fulfilled")) throw new Error(`Company research failed. ${warnings.join(" ")}`);
  const deduped = [...new Map(evidence.map(item => [item.url.replace(/[#?].*$/, ""), item])).values()];
  return {
    name: safeName, searchedAt: new Date().toISOString(), evidence: deduped, warnings,
    fields: buildCompanyFields(safeName, sector, geography, deduped),
    questions: [
      "Who are the paying customers, and how much repeat revenue is there?",
      "What are the unit economics and scale-up constraints?",
      "Which permits, collection rights, or policy changes affect operations?",
      "What evidence supports the claimed product advantage?",
    ],
  };
}
