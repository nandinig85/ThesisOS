import { createHash } from "node:crypto";
import type { Development, Evidence, Risk, SearchRun, StartupCandidate, ThesisInput } from "./types";
import { interpretRisk } from "./risk-chain.ts";

type UnknownRecord = Record<string, unknown>;
const asRecord = (value: unknown): UnknownRecord => value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
const asText = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const tidy = (value: string): string => value.replace(/\s+/g, " ").trim();
const cleanTitle = (value: string): string => tidy(value.replace(/\s+[-–|:]\s+[^-–|:]+$/, ""));
const keyword = (text: string, words: RegExp): boolean => words.test(text);
const sentences = (text: string) => text.replace(/\b(Rs|Mr|Mrs|Dr|Inc|Ltd)\.\s/g, "$1 ").split(/(?<=[.!?])\s+/);

function safeUrl(value: unknown): string | null {
  try {
    const url = new URL(asText(value));
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

function domainOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

export function normalizeResults(payload: unknown, kind: "search" | "news", query: string): Evidence[] {
  const data = asRecord(payload);
  const results = kind === "search" ? data.organic_results : data.news_results;
  if (!Array.isArray(results)) return [];
  const seen = new Set<string>();
  return results.flatMap((raw, index) => {
    const item = asRecord(raw);
    const title = tidy(asText(item.title));
    const url = safeUrl(item.link);
    if (!title || !url) return [];
    const canonical = url.replace(/[#?].*$/, "").replace(/\/$/, "");
    if (seen.has(canonical)) return [];
    seen.add(canonical);
    const source = asRecord(item.source);
    const snippet = tidy(asText(item.snippet) || asText(item.description));
    const publishedAt = asText(item.date) || asText(source.date);
    return [{
      id: `${kind}-${index}-${createHash("sha256").update(canonical).digest("hex").slice(0, 16)}`,
      kind, title, snippet, url, domain: domainOf(url),
      ...(publishedAt ? { publishedAt } : {}), query,
    }];
  });
}

export function companyName(title: string): string | null {
  const name = cleanTitle(title)
    .replace(/^(?:[\w-]+\s+){0,4}(?:startup|maker|firm|provider)\s+/i, "")
    .replace(/^(?:battery recycler|recycling startup|urban mining startup)\s+/i, "")
    .replace(/^(meet|inside|how|why)\s+/i, "")
    .replace(/\s+(?:has\s+)?(raises?|raised|secures?|secured|bags?|bagged|gets?|lands?|announces?|launches?|expands?|plans?|partners?|wins?|eyes|funding)\b.*$/i, "")
    .trim();
  if (name.startsWith("@") || name.length < 3 || name.length > 48 || name.split(/\s+/).length > 5) return null;
  if (/\b(start[- ]?ups?|companies|firms?|industry|market|sector|news|report|funding|investment|recycling|battery|batteries|list|top|best|post|updates|stocks)\b/i.test(name)) return null;
  return name;
}

function fundingPreview(text: string): string | null {
  const match = text.match(/\b(?:raises?|raised|secures?|secured|bags?|bagged|funding (?:of|hits)|investment of)\s+(?:an?\s+)?(?:[₹$€£]|Rs\.?\s*|INR\s*|USD\s*)?\s*\d+(?:[.,]\d+)?\s*(?:million|billion|crore|cr|lakh|mn|m|bn)?\b/i);
  return match ? tidy(match[0]) : null;
}

export function companyFunding(item: Evidence, name: string): string | null {
  if (item.title.toLowerCase().includes(name.toLowerCase())) {
    const fromTitle = fundingPreview(item.title);
    if (fromTitle) return fromTitle;
  }
  const sentence = sentences(item.snippet).find(part => part.toLowerCase().includes(name.toLowerCase()));
  return sentence ? fundingPreview(sentence) : null;
}

export function companyGeography(item: Evidence, name: string, geography: string): boolean {
  if (item.title.toLowerCase().includes(name.toLowerCase()) && geographyMatch(item.title, geography)) return true;
  const sentence = sentences(item.snippet).find(part => part.toLowerCase().includes(name.toLowerCase()));
  return sentence ? geographyMatch(sentence, geography) : false;
}

export function companyStage(item: Evidence, name: string): string | null {
  const title = item.title.toLowerCase().includes(name.toLowerCase()) ? item.title : "";
  const fromTitle = title.match(/\b(pre[- ]seed|seed|series\s+[a-e]|growth)\b/i);
  const context = sentences(item.snippet).find(part => part.toLowerCase().includes(name.toLowerCase())) || "";
  const match = fromTitle || context.match(/\b(pre[- ]seed|seed|series\s+[a-e]|growth)\b/i);
  return match ? match[0].replace(/\s+/g, " ") : null;
}

export function stageFits(found: string, target: string): boolean {
  const stage = found.toLowerCase().replace(/\s+/g, " ");
  const wanted = target.toLowerCase().replace(/[–—-]/g, " ");
  if (wanted.includes("seed") && wanted.includes("series a")) return stage === "seed" || stage === "series a";
  if (wanted.includes("pre seed")) return stage === "pre-seed" || stage === "pre seed";
  if (wanted === "seed") return stage === "seed";
  if (wanted === "series a") return stage === "series a";
  if (wanted.includes("series b")) return /series [b-e]/.test(stage);
  if (wanted === "growth") return stage === "growth" || /series [c-e]/.test(stage);
  return true;
}

function isRecent(item: Evidence): boolean {
  if (!item.publishedAt) return false;
  const time = Date.parse(item.publishedAt);
  if (!Number.isFinite(time)) return false;
  const now = Date.now();
  return time <= now + 86_400_000 && time >= now - 548 * 86_400_000;
}

function geographyMatch(text: string, geography: string): boolean {
  const place = geography.trim().toLowerCase();
  if (!place) return false;
  if (place === "india") return /\bindia(?:n|’s|'s)?\b/i.test(text);
  return text.toLowerCase().includes(place);
}

function topicMatch(text: string, sector: string): boolean {
  if (/recycl/i.test(sector)) return /recycl|upcycl|circular|urban mining/i.test(text) && (!/batter/i.test(sector) || /batter|lithium|\bEV\b/i.test(text));
  const important = sector.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 3 && !["sector", "industry", "market"].includes(word));
  return important.length === 0 || important.filter(word => text.toLowerCase().includes(word)).length >= Math.min(important.length, 2);
}

export function companyTopicMatch(item: Evidence, name: string, sector: string): boolean {
  if (item.title.toLowerCase().includes(name.toLowerCase()) && topicMatch(item.title, sector)) return true;
  return sentences(item.snippet).some(part => part.toLowerCase().includes(name.toLowerCase()) && topicMatch(part, sector));
}

function storyTokens(title: string): Set<string> {
  const stop = new Set(["india", "indian", "ev", "battery", "batteries", "recycling", "lithium", "ion", "the", "and", "with", "from", "into", "under", "for", "new", "market", "funding", "million"]);
  return new Set((title.toLowerCase().match(/[a-z]+|\d+/g) || [])
    .map(token => token.replace(/^launch(?:ed|es)?$/, "launch").replace(/^call(?:ed|s)?$/, "call"))
    .filter(token => token.length > 2 && !stop.has(token)));
}

function storyAmounts(title: string): Set<string> {
  return new Set((title.match(/(?:[$€£₹]|\b(?:Rs\.?|INR|USD|EUR)\s*)\s*\d+(?:[.,]\d+)?/gi) || [])
    .map(value => value.match(/\d+(?:[.,]\d+)?/)?.[0].replace(",", ".") || "")
    .filter(Boolean));
}

function sameStory(left: Evidence, right: Evidence): boolean {
  const a = storyTokens(left.title);
  const b = storyTokens(right.title);
  const smaller = Math.min(a.size, b.size);
  const common = [...a].filter(token => b.has(token)).length;
  if (smaller >= 3 && common >= 3 && common / smaller >= 0.6) return true;
  const amounts = storyAmounts(left.title);
  if (![...amounts].some(amount => storyAmounts(right.title).has(amount))) return false;
  const rightWords = new Set(right.title.toLowerCase().match(/[a-z]{3,}/g) || []);
  const shared = new Set((left.title.toLowerCase().match(/[a-z]{3,}/g) || [])
    .filter(token => rightWords.has(token)));
  const leftTime = Date.parse(left.publishedAt || "");
  const rightTime = Date.parse(right.publishedAt || "");
  return shared.size >= 2 && Number.isFinite(leftTime) && Number.isFinite(rightTime) && Math.abs(leftTime - rightTime) <= 14 * 86_400_000;
}

function groupStories(items: Evidence[]): Evidence[][] {
  const groups: Evidence[][] = [];
  for (const item of items) {
    const group = groups.find(existing => existing.some(previous => sameStory(previous, item)));
    if (group) group.push(item);
    else groups.push([item]);
  }
  return groups;
}

function categoryOf(text: string): Development["category"] {
  if (keyword(text, /\b(policy|regulation|rule|tariff|law|mandate|government|subsidy|import duty|compliance)\b/i)) return "Policy";
  if (keyword(text, /\b(rais(?:e|ed|es)|funding|investment|series [a-z]|seed round|venture capital)\b/i)) return "Funding";
  if (keyword(text, /\b(patent|research|technology|process|innovation|breakthrough)\b/i)) return "Technology";
  return "Market";
}

export function assembleRun(input: ThesisInput, evidence: Evidence[], queries: SearchRun["queries"], warnings: string[]): SearchRun {
  const unique = new Map<string, Evidence>();
  for (const item of evidence) {
    const key = item.url.replace(/[#?].*$/, "").replace(/\/$/, "");
    if (!unique.has(key)) unique.set(key, item);
  }
  const items = [...unique.values()];
  const startupMap = new Map<string, StartupCandidate>();
  const excludedNames = new Set<string>();
  for (const item of items.filter(e => e.kind === "search" || (e.kind === "news" && /\b(raises?|raised|secures?|secured|funding|fundraise|partners?)\b/i.test(e.title)))) {
    if (/\bpost\b/i.test(item.title) || /(?:linkedin\.com|facebook\.com|instagram\.com)$/.test(item.domain)) continue;
    if (/recycl/i.test(input.sector) && /\bbattery[- ]swapp|\bafrica(?:n|’s|'s)?\b/i.test(item.title)) continue;
    const name = companyName(item.title);
    if (!name) continue;
    if (!companyTopicMatch(item, name, input.sector)) continue;
    const key = name.toLowerCase();
    if (/\b(seed|series\s*a|pre[- ]?seed)\b/i.test(input.stage) && /\bIPO\b|\bpublic listing\b|\bplans to list\b/i.test(item.title)) {
      excludedNames.add(key);
      startupMap.delete(key);
      continue;
    }
    const funding = companyFunding(item, name);
    const located = companyGeography(item, name, input.geography);
    const stage = companyStage(item, name);
    if (stage && !stageFits(stage, input.stage)) {
      excludedNames.add(key);
      startupMap.delete(key);
      continue;
    }
    if (excludedNames.has(key)) continue;
    const existing = startupMap.get(key);
    if (existing) {
      existing.evidenceIds.push(item.id);
      if (funding && existing.fundingStatus === "unavailable") {
        existing.funding = funding;
        existing.fundingStatus = "inferred";
        existing.fundingEvidenceId = item.id;
      }
      if (located && existing.geographyStatus === "unavailable") {
        existing.geography = input.geography;
        existing.geographyStatus = "inferred";
        existing.geographyEvidenceId = item.id;
      }
      if (stage && existing.stageStatus === "unavailable") {
        existing.stage = stage;
        existing.stageStatus = "inferred";
        existing.stageEvidenceId = item.id;
      }
    } else {
      startupMap.set(key, {
        id: `company-${startupMap.size + 1}`,
        name,
        description: item.snippet.toLowerCase().includes(name.toLowerCase()) ? item.snippet : item.title,
        nameStatus: "inferred",
        funding: funding || "No funding figure in cited search preview",
        fundingStatus: funding ? "inferred" : "unavailable",
        geography: located ? input.geography : "Not established in cited preview",
        geographyStatus: located ? "inferred" : "unavailable",
        stage: stage || "Not established in cited preview",
        stageStatus: stage ? "inferred" : "unavailable",
        evidenceIds: [item.id],
        ...(funding ? { fundingEvidenceId: item.id } : {}),
        ...(located ? { geographyEvidenceId: item.id } : {}),
        ...(stage ? { stageEvidenceId: item.id } : {}),
      });
    }
  }

  const relevantNews = groupStories(items.filter(e => e.kind === "news" && isRecent(e) && topicMatch(`${e.title} ${e.snippet}`, input.sector) && geographyMatch(`${e.title} ${e.snippet}`, input.geography) && !/\b(best stocks|\d+ stocks?|stocks? positioning|stock picks?|guide|cost & roi|market analysis|forecast|how to)\b/i.test(e.title)));
  const policyItem = relevantNews.find(group => group.some(item => categoryOf(`${item.title} ${item.snippet}`) === "Policy"));
  const selectedNews = [...relevantNews.slice(0, 7), ...(policyItem && !relevantNews.slice(0, 7).includes(policyItem) ? [policyItem] : [])].slice(0, 8);
  const developments: Development[] = selectedNews.map((group, index) => ({
    id: `development-${index + 1}`,
    title: group[0].title,
    summary: group[0].snippet || "Headline preview only. Open the source for detail.",
    category: categoryOf(`${group[0].title} ${group[0].snippet}`),
    status: "confirmed",
    evidenceId: group[0].id,
    evidenceIds: group.map(item => item.id),
  }));

  const riskTerms = /\b(risk|ban|tariff|shortage|delay|loss|decline|lawsuit|regulat\w*|norms?|restriction|competition|price drop|oversupply|safety|pollution|fire|scrutiny)\b/i;
  const risks: Risk[] = relevantNews.map(group => group.find(item => riskTerms.test(`${item.title} ${item.snippet}`))).filter((item): item is Evidence => !!item).slice(0, 5).map((item, index) => ({
    id: `risk-${index + 1}`,
    title: item.title,
    ...interpretRisk(item, input),
    evidenceId: item.id,
  }));

  return {
    thesis: input, searchedAt: new Date().toISOString(), evidence: items,
    startups: [...startupMap.values()].slice(0, 8), developments, risks, signals: { trend: null, jobs: [], papers: [], patents: [] }, queries, warnings,
  };
}
