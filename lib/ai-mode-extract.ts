import type { AICitation, AIPoint, AIVoice, CommitteeVoice } from "./types";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const string = (value: unknown): string => typeof value === "string" ? value.trim().replace(/\\text\{([^}]+)\}/g, "$1").replace(/\\%/g, "%").replace(/\$([^$]+)\$/g, "$1").replace(/\s+/g, " ") : "";

function citation(value: unknown): AICitation | null {
  const item = record(value);
  try {
    const url = new URL(string(item.link));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return { title: string(item.title) || url.hostname, url: url.toString(), domain: url.hostname.replace(/^www\./, "") };
  } catch { return null; }
}

export function parseAIMode(payload: unknown, role: CommitteeVoice["role"] | "Chair"): AIVoice | null {
  const data = record(payload);
  const references = Array.isArray(data.references) ? data.references : [];
  const byIndex = new Map<number, AICitation>();
  references.forEach((raw, position) => {
    const item = record(raw);
    const link = citation(raw);
    if (!link) return;
    byIndex.set(position, link);
    if (typeof item.index === "number") byIndex.set(item.index, link);
  });
  const sourceFor = (value: unknown): AICitation[] => {
    if (!Array.isArray(value)) return [];
    return [...new Map(value.filter(index => typeof index === "number").map(index => byIndex.get(index)).filter((item): item is AICitation => !!item).map(item => [item.url, item])).values()];
  };
  const blocks = Array.isArray(data.text_blocks) ? data.text_blocks : [];
  const points: AIPoint[] = [];
  const useful = (value: string) => value.length >= 50 && !value.endsWith("?") && !/^(if you|would you like|let me know|detail the|map out|explore the)\b/i.test(value) && !(value.length < 90 && !/[.!]$/.test(value));
  const addPoint = (value: string, indexes: unknown) => {
    if (!useful(value) || points.length >= 16) return;
    const citations = sourceFor(indexes);
    const text = value.replace(/^Confirmed Facts:\s*/i, citations.length ? "AI Mode claim with citation: " : "Uncited AI claim: ");
    points.push({ text: text.slice(0, 550), citations });
  };
  const visit = (raw: unknown, inheritedIndexes: unknown, depth: number): void => {
    if (depth > 5 || points.length >= 16) return;
    const block = record(raw);
    const indexes = block.reference_indexes || inheritedIndexes;
    if (block.type === "paragraph") addPoint(string(block.snippet), indexes);
    if (block.type === "list" && Array.isArray(block.list)) {
      for (const rawItem of block.list) {
        const item = record(rawItem);
        if (Array.isArray(item.text_blocks)) item.text_blocks.forEach(child => visit(child, item.reference_indexes || indexes, depth + 1));
        else addPoint([string(item.title), string(item.snippet)].filter(Boolean).join(": "), item.reference_indexes || indexes);
      }
    }
    if (Array.isArray(block.text_blocks)) block.text_blocks.forEach(child => visit(child, indexes, depth + 1));
  };
  blocks.forEach(block => visit(block, undefined, 0));
  if (!points.length) return null;
  const roleTerms: Record<CommitteeVoice["role"] | "Chair", RegExp> = {
    Market: /market|demand|econom|competit|capacity|feedstock/i,
    Bull: /growth|opportun|demand|value|upside|scale|recovery|funding/i,
    Bear: /risk|margin|feedstock|price|competit|cost|uncertain|capex/i,
    Regulatory: /rule|regulat|EPR|mandat|policy|compliance|permit|incentive/i,
    Chair: /evidence|risk|uncertain|diligence|market|invest|verify/i,
  };
  const summaryPoint = points.find(point => point.text.length >= 65 && point.citations.length > 0 && roleTerms[role].test(point.text)) || points.find(point => point.text.length >= 110 && point.citations.length > 0) || points.find(point => point.text.length >= 110) || points[0];
  const summary = summaryPoint.text;
  const shown = points.filter(point => point !== summaryPoint).sort((a, b) => Number(b.citations.length > 0) - Number(a.citations.length > 0)).slice(0, 3);
  const used = [...new Map(references.map(citation).filter((item): item is AICitation => !!item).map(item => [item.url, item])).values()].slice(0, 6);
  return { role, summary, summaryCitations: summaryPoint.citations, points: shown, references: used };
}
