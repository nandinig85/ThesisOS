import { companyFunding, companyGeography } from "./extract.ts";
import type { DeepDiveField, Evidence } from "./types";

const containsName = (item: Evidence, name: string) => `${item.title} ${item.snippet}`.toLowerCase().includes(name.toLowerCase());
const time = (item: Evidence) => Date.parse(item.publishedAt || "") || 0;

function profileScore(item: Evidence, name: string, sector: string): number {
  const snippet = item.snippet.toLowerCase();
  const sectorWords = sector.toLowerCase().split(/[^a-z]+/).filter(word => word.length >= 5);
  return (snippet.includes(name.toLowerCase()) ? 3 : 0)
    + (sectorWords.some(word => snippet.includes(word)) ? 3 : 0)
    + (/\b(operates|develops|specializes|manufactures|recycles|extracts|provides)\b/i.test(item.snippet) ? 4 : 0)
    + (/company profile|about the company/i.test(item.title + item.snippet) ? 2 : 0)
    - (/\b(funding|raises|raised|round)\b/i.test(item.snippet) ? 4 : 0)
    - (/^in conclusion/i.test(item.snippet) ? 8 : 0);
}

function founderMention(item: Evidence): string | null {
  const text = `${item.title}. ${item.snippet}`;
  const match = text.match(/\b(?:founders?|founded by|co[- ]founder(?:\s*&\s*\w+)?|cofounder)\s*:?\s+(?:is\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/i);
  return match?.[1] || null;
}

function investorMention(item: Evidence): string | null {
  const text = `${item.title}. ${item.snippet}`;
  const match = text.match(/\b(?:led by|backed by)\s+([A-Z][A-Za-z& ]{2,65}?)(?=\s*(?:[.,;]|\b(?:alongside|with|in|to)\b|$))/i);
  return match?.[1].trim() || null;
}

export function buildCompanyFields(name: string, sector: string, geography: string, evidence: Evidence[]): DeepDiveField[] {
  const named = evidence.filter(item => containsName(item, name));
  const organic = named.filter(item => item.kind === "search");
  const news = named.filter(item => item.kind === "news").sort((a, b) => time(b) - time(a));
  const description = organic.filter(item => item.snippet.length > 35).sort((a, b) => profileScore(b, name, sector) - profileScore(a, name, sector))[0];
  const funding = [...news, ...organic].map(item => ({ item, value: companyFunding(item, name) })).find(result => result.value);
  const located = named.find(item => companyGeography(item, name, geography));
  const founder = organic.map(item => ({ item, value: founderMention(item) })).find(result => result.value);
  const fundingAmount = funding?.value?.match(/\d+(?:[.,]\d+)?/)?.[0];
  const investor = fundingAmount ? [...news, ...organic]
    .filter(item => new RegExp(`\\b${fundingAmount.replace(".", "\\.")}\\b`).test(`${item.title} ${item.snippet}`))
    .map(item => ({ item, value: investorMention(item) })).find(result => result.value) : undefined;
  const partnership = news.find(item => item.title.toLowerCase().includes(name.toLowerCase()) && /\b(partners?|partnership|agreement|mou)\b/i.test(item.title));
  const latest = news[0];
  return [
    { label: "Product / activity preview", value: description?.snippet || "No company-specific description in results", status: description ? "inferred" : "unavailable", evidenceId: description?.id },
    { label: "Latest funding mention", value: funding?.value || "No company-specific funding figure in results", status: funding ? "inferred" : "unavailable", evidenceId: funding?.item.id },
    { label: "Investor tied to funding mention", value: investor?.value || "No investor linked to this funding mention", status: investor ? "inferred" : "unavailable", evidenceId: investor?.item.id },
    { label: "Geography mention", value: located ? geography : "No company-specific geography mention", status: located ? "inferred" : "unavailable", evidenceId: located?.id },
    { label: "Founder mention", value: founder?.value || "No founder named in company-specific preview", status: founder ? "inferred" : "unavailable", evidenceId: founder?.item.id },
    { label: "Customer traction", value: "Unavailable from company-specific public previews", status: "unavailable" },
    { label: "Partnership headline", value: partnership?.title || "No company-specific partnership headline returned", status: partnership ? "confirmed" : "unavailable", evidenceId: partnership?.id },
    { label: "Competitive advantage", value: "Unverified; requires technical and customer diligence", status: "unavailable" },
    { label: "Recent headline", value: latest?.title || "No company-specific news headline in results", status: latest ? "confirmed" : "unavailable", evidenceId: latest?.id },
  ];
}
