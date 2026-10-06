import type { CommitteeAnalysis, CommitteeVoice, SearchRun } from "./types";

const cap = (number: number, maximum: number) => Math.min(maximum, Math.max(0, number));

export function buildCommittee(run: SearchRun): CommitteeAnalysis {
  const domains = new Set(run.evidence.map(item => item.domain)).size;
  const located = run.startups.filter(item => item.geographyStatus !== "unavailable").length;
  const funded = run.startups.filter(item => item.fundingStatus !== "unavailable").length;
  const policies = run.developments.filter(item => item.category === "Policy");
  const dimensions = [
    { label: "Source diversity", points: cap(domains * 4, 20), maxPoints: 20, explanation: `${domains} distinct source domains` },
    { label: "Company evidence", points: cap(located * 10 + funded * 3, 40), maxPoints: 40, explanation: `${located} geography mentions · ${funded} funding mentions` },
    { label: "Market activity", points: cap(run.developments.length * 4, 20), maxPoints: 20, explanation: `${run.developments.length} distinct news events` },
    { label: "Risk visibility", points: cap(run.risks.length * 4 + policies.length * 4, 20), maxPoints: 20, explanation: `${run.risks.length} risk signals · ${policies.length} policy items` },
  ];
  const readinessScore = dimensions.reduce((sum, item) => sum + item.points, 0);
  const firstStartup = run.startups[0];
  const firstRisk = run.risks[0];
  const firstPolicy = policies[0];
  const voices: CommitteeVoice[] = [
    {
      role: "Market",
      observation: run.developments.length ? `${run.developments.length} geography-relevant news events surfaced. These show coverage, not market size or demand.` : "No geography-relevant news event was found in this run.",
      nextQuestion: "What are the actual market size, customer demand, and unit economics?",
      evidenceIds: run.developments.slice(0, 2).map(item => item.evidenceId),
    },
    {
      role: "Bull",
      observation: run.startups.length ? `${run.startups.length} potential company names surfaced; ${funded} have a funding mention tied to their own name. This is discovery evidence, not traction proof.` : "No company candidates passed conservative extraction.",
      nextQuestion: "Which candidates have customer references, repeat revenue, and a defensible advantage?",
      evidenceIds: firstStartup?.evidenceIds.slice(0, 2) || [],
    },
    {
      role: "Bear",
      observation: firstRisk ? `A relevant risk preview flags: “${firstRisk.title}”. Private-company traction and financials remain unverified.` : "No explicit risk headline passed the geography filter; downside diligence is still needed.",
      nextQuestion: "What would invalidate the thesis within 12–24 months?",
      evidenceIds: firstRisk ? [firstRisk.evidenceId] : [],
    },
    {
      role: "Regulatory",
      observation: firstPolicy ? `A policy-related result surfaced: “${firstPolicy.title}”. Its actual applicability needs legal or specialist review.` : "No geography-relevant policy headline surfaced in this run.",
      nextQuestion: "Which current rules, incentives, and compliance costs apply to this segment?",
      evidenceIds: firstPolicy ? [firstPolicy.evidenceId] : [],
    },
  ];
  const chair = readinessScore >= 65 && located >= 2
    ? "There is enough public evidence to select companies for direct diligence. Do not treat this as an invest recommendation; verify source claims, customer traction, economics, and policy exposure."
    : "Public evidence is too thin for a confident committee decision. Broaden sources and verify company identity, geography, funding, customer traction, and regulation before screening investments.";
  return { readinessScore, dimensions, voices, chair };
}
