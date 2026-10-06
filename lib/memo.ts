import type { AICommitteeRun, SearchRun } from "./types";

export interface MemoSource {
  number: number;
  title: string;
  url: string;
  kind: string;
}

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}

export function buildMemoSources(run: SearchRun, ai?: AICommitteeRun | null) {
  const sources: MemoSource[] = [];
  const urlNumbers: Record<string, number> = {};
  const evidenceNumbers: Record<string, number> = {};
  const evidenceById = new Map(run.evidence.map(item => [item.id, item]));
  const add = (url: string, title: string, kind: string) => {
    const safe = safeUrl(url);
    if (!safe) return;
    if (!urlNumbers[safe]) {
      const number = sources.length + 1;
      urlNumbers[safe] = number;
      sources.push({ number, title, url: safe, kind });
    }
  };
  const addEvidence = (id: string) => {
    const item = evidenceById.get(id);
    if (!item) return;
    add(item.url, item.title, item.kind);
    const safe = safeUrl(item.url);
    if (safe) evidenceNumbers[id] = urlNumbers[safe];
  };

  run.startups.forEach(item => {
    [...new Set([item.evidenceIds[0], item.fundingEvidenceId, item.geographyEvidenceId, item.stageEvidenceId].filter((id): id is string => !!id))].forEach(addEvidence);
  });
  run.developments.forEach(item => item.evidenceIds.forEach(addEvidence));
  run.risks.forEach(item => addEvidence(item.evidenceId));
  run.committee?.voices.forEach(item => item.evidenceIds.forEach(addEvidence));
  if (run.signals.trend) add(run.signals.trend.url, `Google Trends: ${run.signals.trend.query}`, "trends");
  run.signals.jobs.forEach(item => add(item.url, `${item.company}: ${item.title}`, "jobs"));
  run.signals.papers.forEach(item => add(item.url, item.title, "scholar"));
  run.signals.patents.forEach(item => add(item.url, item.title, "patent"));
  ai?.voices.forEach(voice => voice.references.forEach(item => add(item.url, item.title, `AI Mode ${voice.role}`)));
  if (ai?.chair) ai.chair.references.forEach(item => add(item.url, item.title, "AI Mode Chair"));

  return { sources, evidenceNumbers, urlNumbers };
}
