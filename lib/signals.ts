import type { JobSignal, ResearchItem, TrendSignal } from "./types";

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): UnknownRecord => value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
const string = (value: unknown): string => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

function safeUrl(value: unknown): string | null {
  try {
    const url = new URL(string(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}

const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
const topicTerms = (sector: string) => sector.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length >= 4 && !["sector", "industry", "market", "technology"].includes(term)).map(term => term.replace(/(?:ing|ed|s)$/, ""));
const matchesTopic = (text: string, terms: string[]) => terms.length > 0 && terms.filter(term => text.toLowerCase().includes(term)).length >= Math.min(2, terms.length);

export function normalizeTrends(payload: unknown, query: string, geography: string, geo?: string): TrendSignal | null {
  const timeline = record(record(payload).interest_over_time).timeline_data;
  if (!Array.isArray(timeline)) return null;
  const weeks = timeline.flatMap(raw => {
    const item = record(raw);
    const point = Array.isArray(item.values) ? record(item.values[0]) : {};
    const value = point.extracted_value;
    if (item.partial_data || typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) return [];
    return [{ value, date: string(item.date) }];
  });
  if (weeks.length < 26) return null;
  const values = weeks.slice(-52).map(point => point.value);
  const url = new URL("https://trends.google.com/trends/explore");
  url.searchParams.set("date", "today 12-m");
  if (geo) url.searchParams.set("geo", geo.toUpperCase());
  url.searchParams.set("q", query);
  return {
    query, geography, values, latestCompleteWeek: weeks.at(-1)?.date || "",
    recentAverage: average(values.slice(-13)),
    previousAverage: average(values.slice(-26, -13)),
    url: url.toString(),
  };
}

export function normalizeJobs(payload: unknown, sector: string): JobSignal[] {
  const results = record(payload).jobs_results;
  if (!Array.isArray(results)) return [];
  const terms = topicTerms(sector);
  if (!terms.length) return [];
  const seen = new Set<string>();
  return results.flatMap(raw => {
    const item = record(raw);
    const title = string(item.title);
    const company = string(item.company_name);
    const location = string(item.location);
    const text = `${title} ${company} ${string(item.description)}`.toLowerCase();
    if (!title || !company || !matchesTopic(text, terms)) return [];
    const options = Array.isArray(item.apply_options) ? item.apply_options : [];
    const url = options.map(option => safeUrl(record(option).link)).find(Boolean) || safeUrl(item.share_link);
    if (!url) return [];
    const key = `${title.toLowerCase()}|${company.toLowerCase()}|${location.toLowerCase()}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const postedAt = string(record(item.detected_extensions).posted_at);
    return [{ title, company, location: location || "Location not specified", ...(postedAt ? { postedAt } : {}), url }];
  }).slice(0, 5);
}

export function normalizeScholar(payload: unknown, sector: string): ResearchItem[] {
  const results = record(payload).organic_results;
  if (!Array.isArray(results)) return [];
  const terms = topicTerms(sector);
  const seen = new Set<string>();
  return results.flatMap(raw => {
    const item = record(raw);
    const title = string(item.title);
    const snippet = string(item.snippet);
    const url = safeUrl(item.link);
    if (!title || !url || !matchesTopic(`${title} ${snippet}`, terms) || seen.has(url)) return [];
    const publication = string(record(item.publication_info).summary);
    const years = [...publication.matchAll(/\b(?:19|20)\d{2}\b/g)].map(match => Number(match[0]));
    if (years.some(year => year > new Date().getUTCFullYear())) return [];
    seen.add(url);
    return [{ title, snippet: snippet.slice(0, 220), url, detail: publication.slice(0, 150) || "Publication details unavailable" }];
  }).slice(0, 5);
}

export function normalizePatents(payload: unknown, sector: string): ResearchItem[] {
  const results = record(payload).organic_results;
  if (!Array.isArray(results)) return [];
  const terms = topicTerms(sector);
  const seen = new Set<string>();
  return results.flatMap(raw => {
    const item = record(raw);
    if (item.is_scholar === true) return [];
    const title = string(item.title);
    const snippet = string(item.snippet);
    const url = safeUrl(item.patent_link);
    if (!title || !url || !matchesTopic(`${title} ${snippet}`, terms) || seen.has(url)) return [];
    if (/batter\w*\s+recycl\w*|recycl\w*\s+batter\w*/i.test(sector) && ![title, snippet].some(text => /batter\w*.{0,55}recycl\w*|recycl\w*\s+(?:of\s+)?(?:waste\s+)?batter\w*/i.test(text))) return [];
    seen.add(url);
    const detail = [string(item.assignee) || "Assignee unavailable", string(item.publication_number), string(item.publication_date)].filter(Boolean).join(" · ");
    return [{ title, snippet: snippet.slice(0, 220), url, detail }];
  }).slice(0, 5);
}
