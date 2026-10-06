export type EvidenceStatus = "confirmed" | "inferred" | "unavailable";
export type EvidenceKind = "search" | "news";

export interface ThesisInput {
  sector: string;
  geography: string;
  stage: string;
  thesis: string;
}

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  title: string;
  snippet: string;
  url: string;
  domain: string;
  publishedAt?: string;
  query: string;
}

export interface StartupCandidate {
  id: string;
  name: string;
  description: string;
  nameStatus: EvidenceStatus;
  funding: string;
  fundingStatus: EvidenceStatus;
  geography: string;
  geographyStatus: EvidenceStatus;
  stage: string;
  stageStatus: EvidenceStatus;
  evidenceIds: string[];
  fundingEvidenceId?: string;
  geographyEvidenceId?: string;
  stageEvidenceId?: string;
}

export interface Development {
  id: string;
  title: string;
  summary: string;
  category: "Funding" | "Policy" | "Market" | "Technology";
  status: EvidenceStatus;
  evidenceId: string;
  evidenceIds: string[];
}

export interface Risk {
  id: string;
  title: string;
  marketEffect: string;
  thesisImplication: string;
  status: EvidenceStatus;
  evidenceId: string;
}

export interface ScoreDimension {
  label: string;
  points: number;
  maxPoints: number;
  explanation: string;
}

export interface CommitteeVoice {
  role: "Market" | "Bull" | "Bear" | "Regulatory";
  observation: string;
  nextQuestion: string;
  evidenceIds: string[];
}

export interface CommitteeAnalysis {
  readinessScore: number;
  dimensions: ScoreDimension[];
  voices: CommitteeVoice[];
  chair: string;
}

export interface AICitation {
  title: string;
  url: string;
  domain: string;
}

export interface AIPoint {
  text: string;
  citations: AICitation[];
}

export interface AIVoice {
  role: CommitteeVoice["role"] | "Chair";
  summary: string;
  summaryCitations: AICitation[];
  points: AIPoint[];
  references: AICitation[];
}

export interface AICommitteeRun {
  generatedAt: string;
  voices: AIVoice[];
  chair?: AIVoice;
  warnings: string[];
}

export interface TrendSignal {
  query: string;
  geography: string;
  values: number[];
  latestCompleteWeek: string;
  recentAverage: number;
  previousAverage: number;
  url: string;
}

export interface JobSignal {
  title: string;
  company: string;
  location: string;
  postedAt?: string;
  url: string;
}

export interface ResearchItem {
  title: string;
  snippet: string;
  url: string;
  detail: string;
}

export interface ResearchSignals {
  trend: TrendSignal | null;
  jobs: JobSignal[];
  papers: ResearchItem[];
  patents: ResearchItem[];
}

export interface DeepDiveField {
  label: string;
  value: string;
  status: EvidenceStatus;
  evidenceId?: string;
}

export interface CompanyDeepDive {
  name: string;
  searchedAt: string;
  evidence: Evidence[];
  fields: DeepDiveField[];
  questions: string[];
  warnings: string[];
}

export interface SearchRun {
  thesis: ThesisInput;
  searchedAt: string;
  evidence: Evidence[];
  startups: StartupCandidate[];
  developments: Development[];
  risks: Risk[];
  signals: ResearchSignals;
  committee?: CommitteeAnalysis;
  queries: { label: string; engine: EvidenceKind | "trends" | "jobs" | "scholar" | "patents"; query: string; ok: boolean }[];
  warnings: string[];
}
