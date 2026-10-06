"use client";

import { useMemo, useRef, useState } from "react";
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, BriefcaseBusiness, Check,
  ChevronDown, CircleAlert, Clock3, ExternalLink, FileSearch, Globe2,
  Layers3, Link2, LoaderCircle, Menu, Radar, Search, ShieldAlert, Sparkles,
  TrendingUp, X,
} from "lucide-react";
import type { AICitation, AICommitteeRun, CompanyDeepDive, Evidence, EvidenceStatus, ResearchItem, SearchRun, ThesisInput } from "@/lib/types";
import { InvestmentMemo } from "@/components/InvestmentMemo";

const initialThesis: ThesisInput = {
  sector: "EV battery recycling",
  geography: "India",
  stage: "Seed–Series A",
  thesis: "Which startups show credible early traction, and what policy or market shifts could change the thesis?",
};

function Status({ value }: { value: EvidenceStatus }) {
  return <span className={`status status-${value}`}><span className="status-dot" />{value}</span>;
}

function EvidenceLink({ item, compact = false }: { item?: Evidence; compact?: boolean }) {
  if (!item) return null;
  return <a className={`source-link ${compact ? "source-link-compact" : ""}`} href={item.url} target="_blank" rel="noopener noreferrer" title={item.url}>
    <Link2 size={13} strokeWidth={2.2} /><span>{item.domain}</span><ArrowUpRight size={13} strokeWidth={2.1} />
  </a>;
}

function AICitationLinks({ citations }: { citations: AICitation[] }) {
  return <div className="ai-point-sources">{citations.length ? citations.slice(0, 2).map(citation => <a key={citation.url} href={citation.url} target="_blank" rel="noopener noreferrer"><Link2 size={12} />{citation.domain}<ArrowUpRight size={12} /></a>) : <span>No point-level source · verify this AI claim</span>}</div>;
}

function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) {
  return <div className="metric-card">
    <div className="metric-top"><span className={`metric-icon ${tone}`}>{icon}</span><ArrowUpRight size={16} className="metric-arrow" /></div>
    <div className="metric-value">{value}</div><div className="metric-label">{label}</div><div className="metric-detail">{detail}</div>
  </div>;
}

function TrendChart({ values }: { values: number[] }) {
  const points = values.map((value, index) => `${index / Math.max(values.length - 1, 1) * 600},${112 - value}`).join(" ");
  return <svg className="trend-chart" viewBox="0 0 600 120" preserveAspectRatio="none" role="img" aria-label="Weekly relative Google search interest over the past 12 months, from zero to one hundred"><line x1="0" y1="112" x2="600" y2="112" /><line x1="0" y1="62" x2="600" y2="62" /><line x1="0" y1="12" x2="600" y2="12" /><polyline points={points} /></svg>;
}

function ResearchCard({ overline, title, intro, items, empty }: { overline: string; title: string; intro: string; items: ResearchItem[]; empty: string }) {
  return <section className="data-panel signal-panel"><div className="data-panel-heading"><div><span className="small-overline">{overline}</span><h3>{title}</h3></div><span className="round-icon"><FileSearch size={17} /></span></div><p className="signal-caveat">{intro}</p>{items.length ? <div className="research-list">{items.map(item => <a className="research-item" key={item.url} href={item.url} target="_blank" rel="noopener noreferrer"><strong>{item.title}</strong><span>{item.detail}</span>{item.snippet && <p>{item.snippet}</p>}<ArrowUpRight size={15} /></a>)}</div> : <div className="empty-mini">{empty}</div>}</section>;
}

export default function Home() {
  const [form, setForm] = useState<ThesisInput>(initialThesis);
  const [run, setRun] = useState<SearchRun | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "committee" | "sources" | "memo">("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [deepDive, setDeepDive] = useState<CompanyDeepDive | null>(null);
  const [deepDivePending, setDeepDivePending] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState("");
  const [aiCommittee, setAICommittee] = useState<AICommitteeRun | null>(null);
  const [aiPending, setAIPending] = useState(false);
  const [aiError, setAIError] = useState("");
  const aiRequestVersion = useRef(0);

  const evidenceById = useMemo(() => new Map(run?.evidence.map(item => [item.id, item]) || []), [run]);
  const company = run?.startups.find(item => item.id === selectedCompany);
  const deepDiveEvidence = useMemo(() => new Map(deepDive?.evidence.map(item => [item.id, item]) || []), [deepDive]);

  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    aiRequestVersion.current += 1;
    setPending(true); setError(""); setRun(null); setSelectedCompany(null); setDeepDive(null); setAICommittee(null); setAIError(""); setAIPending(false);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Research could not be completed.");
      setRun(data as SearchRun);
      setActiveTab("overview");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Research could not be completed.");
    } finally { setPending(false); }
  }

  async function openCompany(id: string) {
    const candidate = run?.startups.find(item => item.id === id);
    if (!candidate || !run) return;
    setSelectedCompany(id); setDeepDive(null); setDeepDiveError(""); setDeepDivePending(true);
    try {
      const response = await fetch("/api/company", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: candidate.name, sector: run.thesis.sector, geography: run.thesis.geography }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Company research could not be completed.");
      setDeepDive(data as CompanyDeepDive);
    } catch (caught) {
      setDeepDiveError(caught instanceof Error ? caught.message : "Company research could not be completed.");
    } finally { setDeepDivePending(false); }
  }

  async function generateAIPerspectives() {
    if (!run) return;
    const version = ++aiRequestVersion.current;
    setAIPending(true); setAIError(""); setAICommittee(null);
    try {
      const context = {
        thesis: run.thesis,
        evidence: run.evidence.map(({ id, domain }) => ({ id, domain })),
        startups: run.startups.map(({ name, funding, fundingStatus, geographyStatus }) => ({ name, funding, fundingStatus, geographyStatus })),
        developments: run.developments.map(({ title, category, evidenceId }) => ({ title, category, evidenceId })),
        risks: run.risks.map(({ title, evidenceId }) => ({ title, evidenceId })),
      };
      const response = await fetch("/api/committee-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(context) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Google AI Mode could not generate perspectives.");
      if (version === aiRequestVersion.current) setAICommittee(data as AICommitteeRun);
    } catch (caught) {
      if (version === aiRequestVersion.current) setAIError(caught instanceof Error ? caught.message : "Google AI Mode could not generate perspectives.");
    } finally { if (version === aiRequestVersion.current) setAIPending(false); }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Layers3 size={20} strokeWidth={2.3} /></div><div><strong>thesis<span>OS</span></strong><small>INVESTMENT INTELLIGENCE</small></div></div>
      <div className="side-section-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        <button className="side-item selected" onClick={() => { setActiveTab("overview"); setMobileNav(false); }}><Radar size={18} />Thesis explorer<ArrowRight size={14} className="side-item-end" /></button>
        <button className="side-item" onClick={() => { setActiveTab("sources"); setMobileNav(false); }}><FileSearch size={18} />Evidence library</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="live-note"><span className="live-indicator" /><span>Powered by live search</span></div>
        <div className="sidebar-footer">Built for the SerpApi India Hackathon<br />Research tool · Verify before investing</div>
      </div>
    </aside>

    <div className="main-area">
      <header className="topbar">
        <button className="mobile-menu" aria-label="Toggle menu" onClick={() => setMobileNav(!mobileNav)}><Menu size={21} /></button>
        <div className="breadcrumb"><span>Workspace</span><span className="slash">/</span><strong>Thesis explorer</strong></div>
        <div className="topbar-right"><span className="topbar-status"><span className="live-indicator" /> Live research</span><span className="avatar">VC</span></div>
      </header>

      <main className="content">
        <div className="heading-row">
          <div><div className="eyebrow"><span className="eyebrow-line" /> RESEARCH WORKSPACE <span className="eyebrow-line" /></div><h1>Make conviction<br /><em>from evidence.</em></h1><p className="subtitle">Explore a market thesis with current search and news signals. Every surfaced insight stays tied to its source.</p></div>
          <div className="heading-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="art-center"><Activity size={29} strokeWidth={1.5} /></div><span className="art-dot dot-one" /><span className="art-dot dot-two" /><span className="art-dot dot-three" /></div>
        </div>

        <section className="thesis-panel" aria-labelledby="thesis-heading">
          <div className="panel-heading"><div className="panel-title"><span className="panel-title-icon"><Search size={17} /></span><div><h2 id="thesis-heading">Define your investment thesis</h2><p>Start broad. We’ll map the live signals around it.</p></div></div><span className="step-tag">01 / RESEARCH</span></div>
          <form onSubmit={analyze}>
            <div className="form-grid">
              <label className="field"><span>SECTOR / THEME</span><input value={form.sector} maxLength={100} onChange={e => setForm({ ...form, sector: e.target.value })} placeholder="e.g. EV battery recycling" required /></label>
              <label className="field"><span>GEOGRAPHY</span><div className="input-with-icon"><Globe2 size={17} /><input value={form.geography} maxLength={80} onChange={e => setForm({ ...form, geography: e.target.value })} placeholder="e.g. India" required /></div></label>
              <label className="field"><span>INVESTMENT STAGE</span><div className="select-wrap"><select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} required><option>Pre-seed</option><option>Seed</option><option>Seed–Series A</option><option>Series A</option><option>Series B+</option><option>Growth</option></select><ChevronDown size={16} /></div></label>
            </div>
            <label className="field thesis-field"><span>YOUR QUESTION <small>OPTIONAL</small></span><textarea value={form.thesis} maxLength={400} onChange={e => setForm({ ...form, thesis: e.target.value })} placeholder="What specific question should this research help answer?" rows={2} /></label>
            <div className="form-bottom"><div className="form-hint"><Sparkles size={15} /> Search results are signals, not investment conclusions.</div><button className="analyze-button" disabled={pending} type="submit">{pending ? <><LoaderCircle size={17} className="spin" />Researching thesis</> : <>Run live research<ArrowRight size={17} /></>}</button></div>
          </form>
        </section>

        {error && <div className="error-banner" role="alert"><CircleAlert size={19} /><div><strong>Research couldn’t run</strong><p>{error}</p></div><button aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}

        <div className="results-heading"><div><div className="section-overline">INTELLIGENCE BRIEF</div><h2>{run ? `${run.thesis.sector} · ${run.thesis.geography}` : "Your research brief"}</h2><p>{run ? `Searched ${new Date(run.searchedAt).toLocaleString()} · ${run.queries.filter(q => q.ok).length}/${run.queries.length} live searches completed` : "Run a thesis search to populate your evidence-backed market view."}</p></div>{run && <span className="result-count"><span className="live-indicator" /> Live results</span>}</div>

        {run ? <>
          {run.warnings.length > 0 && <div className="warning-banner"><CircleAlert size={17} /><span>Some searches failed: {run.warnings.join(" · ")}</span></div>}
          <details className="query-coverage"><summary><span className="small-overline">LIVE RESEARCH FOOTPRINT</span><strong>{run.queries.filter(query => query.ok).length}/{run.queries.length} SerpApi searches completed</strong><span>See the search plan <ChevronDown size={14} /></span></summary><div className="query-coverage-grid">{run.queries.map((query, index) => <div className="query-coverage-item" key={`${query.engine}-${index}`}><span className={query.ok ? "query-ok" : "query-failed"}>{query.ok ? "✓" : "!"}</span><div><strong>{query.label}</strong><small>{query.engine === "search" ? "Google Search" : query.engine === "news" ? "Google News" : `Google ${query.engine.charAt(0).toUpperCase()}${query.engine.slice(1)}`} · {query.query}</small></div></div>)}</div></details>
          <div className="metric-grid">
            <Metric icon={<BriefcaseBusiness size={19} />} label="Startup candidates" value={String(run.startups.length).padStart(2, "0")} detail="From search and news previews" tone="metric-purple" />
            <Metric icon={<TrendingUp size={19} />} label="Developments" value={String(run.developments.length).padStart(2, "0")} detail="Distinct news events" tone="metric-green" />
            <Metric icon={<ShieldAlert size={19} />} label="Risk signals" value={String(run.risks.length).padStart(2, "0")} detail="Items requiring review" tone="metric-amber" />
            <Metric icon={<Link2 size={19} />} label="Cited sources" value={String(run.evidence.length).padStart(2, "0")} detail="Open each original result" tone="metric-blue" />
          </div>
          <div className="tabs"><button className={activeTab === "overview" ? "active" : ""} onClick={() => setActiveTab("overview")}>Overview</button><button className={activeTab === "committee" ? "active" : ""} onClick={() => setActiveTab("committee")}>Investment committee</button><button className={activeTab === "sources" ? "active" : ""} onClick={() => setActiveTab("sources")}>Evidence library <span>{run.evidence.length}</span></button><button className={activeTab === "memo" ? "active" : ""} onClick={() => setActiveTab("memo")}>Investment memo</button></div>
          {activeTab === "overview" ? <div className="dashboard-grid">
            <section className="data-panel startup-panel"><div className="data-panel-heading"><div><span className="small-overline">COMPANY LANDSCAPE</span><h3>Discovered startups</h3></div><span className="count-badge">{run.startups.length} candidates</span></div>
              <p className="panel-disclaimer">Names are inferred from result titles. Geography stays unavailable without a company-specific mention.</p>
              {run.startups.length ? <div className="startup-list">{run.startups.map((item, index) => <button key={item.id} className="startup-row" onClick={() => openCompany(item.id)}><span className="startup-number">{String(index + 1).padStart(2, "0")}</span><div className="startup-main"><div className="startup-name-line"><strong>{item.name}</strong><Status value={item.nameStatus} /></div><p>{item.description}</p><div className="startup-meta"><span>{item.geography} · {item.geographyStatus}</span><span>Stage: {item.stageStatus === "unavailable" ? "unavailable" : item.stage}</span><span>Funding: {item.fundingStatus === "unavailable" ? "unavailable" : item.funding}</span></div></div><ArrowUpRight size={17} className="row-arrow" /></button>)}</div> : <div className="empty-mini">No company names could be extracted conservatively from these results. Check the evidence library.</div>}
            </section>
            <div className="right-column">
              <section className="data-panel"><div className="data-panel-heading"><div><span className="small-overline">WHAT&apos;S MOVING</span><h3>Key developments</h3></div><span className="round-icon"><BarChart3 size={17} /></span></div>{run.developments.length ? <div className="signal-list">{run.developments.map(item => <div className="signal-item" key={item.id}><div className="signal-top"><span className={`category category-${item.category.toLowerCase()}`}>{item.category}</span><Status value={item.status} /></div><h4>{item.title}</h4><p>{item.summary}</p><div className="development-sources"><span>{item.evidenceIds.length} reporting source{item.evidenceIds.length === 1 ? "" : "s"}</span>{item.evidenceIds.slice(0, 3).map(id => <EvidenceLink key={id} item={evidenceById.get(id)} />)}</div></div>)}</div> : <div className="empty-mini">No news items returned for this thesis.</div>}</section>
              <section className="data-panel risk-panel"><div className="data-panel-heading"><div><span className="small-overline">WATCH CLOSELY</span><h3>Potential risks</h3></div><span className="round-icon amber"><ShieldAlert size={17} /></span></div>{run.risks.length ? <div className="risk-list">{run.risks.map(item => <div className="risk-item" key={item.id}><span className="risk-marker" /><div className="risk-content"><div className="risk-chain-step"><span>Source headline</span><h4>{item.title}</h4><EvidenceLink item={evidenceById.get(item.evidenceId)} compact /></div><div className="risk-chain-step"><span>Possible market effect · {item.status}</span><p>{item.marketEffect}</p></div><div className="risk-chain-step"><span>Thesis implication · {item.status}</span><p>{item.thesisImplication}</p></div></div></div>)}</div> : <div className="empty-mini">No explicit risk terms appeared in the returned previews. This is not evidence of low risk.</div>}</section>
            </div>
            <div className="signals-grid"><section className="data-panel signal-panel"><div className="data-panel-heading"><div><span className="small-overline">GOOGLE TRENDS</span><h3>Search momentum</h3></div><span className="round-icon"><TrendingUp size={17} /></span></div>{run.signals.trend ? <><p className="signal-caveat">Relative search interest for “{run.signals.trend.query}” in {run.signals.trend.geography}. Indexed 0–100; this is not market demand.</p><TrendChart values={run.signals.trend.values} /><div className="trend-stats"><div><strong>{run.signals.trend.recentAverage}</strong><span>Recent 13-week average</span></div><div><strong>{run.signals.trend.previousAverage}</strong><span>Previous 13 weeks</span></div></div><p className="signal-footnote">Latest complete week: {run.signals.trend.latestCompleteWeek}. A low-volume topic can fluctuate sharply.</p><a className="source-link" href={run.signals.trend.url} target="_blank" rel="noopener noreferrer">Open in Google Trends <ArrowUpRight size={13} /></a></> : <div className="empty-mini">No usable Trends series returned for this thesis. This does not imply low interest.</div>}</section><section className="data-panel signal-panel"><div className="data-panel-heading"><div><span className="small-overline">GOOGLE JOBS</span><h3>Hiring signals</h3></div><span className="round-icon"><BriefcaseBusiness size={17} /></span></div><p className="signal-caveat">Relevant listings from Google Jobs in {run.thesis.geography}. Open roles suggest hiring activity, not revenue or company growth.</p>{run.signals.jobs.length ? <div className="jobs-list">{run.signals.jobs.map(job => <a className="job-row" key={`${job.company}-${job.title}-${job.url}`} href={job.url} target="_blank" rel="noopener noreferrer"><strong>{job.title}</strong><span>{job.company} · {job.location}{job.postedAt ? ` · ${job.postedAt}` : ""}</span><ArrowUpRight size={15} /></a>)}</div> : <div className="empty-mini">No relevant job listings returned. This does not imply companies are not hiring.</div>}</section></div>
            <div className="signals-grid"><ResearchCard overline="GOOGLE SCHOLAR" title="Research landscape" intro="Recent publications matching this topic and geography. A paper does not establish that a startup owns or commercializes the work." items={run.signals.papers} empty="No matching research publications returned." /><ResearchCard overline="GOOGLE PATENTS" title="Patent landscape" intro="Relevant patents from the global search. Assignees and filings require verification; a patent does not establish a startup moat or freedom to operate." items={run.signals.patents} empty="No matching patents returned. This does not establish freedom to operate." /></div>
          </div> : activeTab === "committee" && run.committee ? <div className="committee-layout">
            <section className="data-panel score-panel"><div className="data-panel-heading"><div><span className="small-overline">TRANSPARENT RESEARCH SCORE</span><h3>Evidence readiness</h3></div><span className="round-icon"><BarChart3 size={17} /></span></div><div className="readiness-score"><strong>{run.committee.readinessScore}</strong><span>/ 100</span></div><p className="score-explainer">Measures how much public evidence this run surfaced. It does not score investment attractiveness.</p><div className="score-dimensions">{run.committee.dimensions.map(item => <div className="score-dimension" key={item.label}><div><strong>{item.label}</strong><span>{item.points}/{item.maxPoints}</span></div><div className="score-track"><span style={{ width: `${item.points / item.maxPoints * 100}%` }} /></div><p>{item.explanation}</p></div>)}</div></section>
            <section className="data-panel chair-panel"><span className="small-overline">COMMITTEE CHAIR</span><h3>Research conclusion</h3><p>{run.committee.chair}</p>{run.thesis.thesis && <div className="chair-question"><span>YOUR QUESTION</span>{run.thesis.thesis}</div>}<div className="chair-method">Rule-based synthesis of this run’s cited previews. Generate separate Google AI Mode perspectives below.</div></section>
            <section className="data-panel ai-panel"><div className="ai-panel-top"><div><span className="small-overline">GENERATIVE SECOND OPINION</span><h3>AI research committee</h3></div><button className="ai-button" disabled={aiPending} onClick={generateAIPerspectives}>{aiPending ? <><LoaderCircle size={15} className="spin" /> Generating…</> : <><Sparkles size={15} />{aiCommittee ? "Regenerate committee" : "Run AI committee"}</>}</button></div><p className="ai-disclaimer">Four role-specific Google AI Mode searches investigate leads from this run, then a fifth chair search reconciles their findings. AI-generated claims and references require source verification; the score above is calculated separately.</p>{aiError && <div className="drawer-error"><CircleAlert size={15} />{aiError}</div>}{aiCommittee?.warnings.length ? <div className="warning-banner"><CircleAlert size={15} />{aiCommittee.warnings.join(" · ")}</div> : null}{aiCommittee && <><div className="ai-generated-at">Generated {new Date(aiCommittee.generatedAt).toLocaleString()} · {aiCommittee.voices.length}/4 researchers{aiCommittee.chair ? " · chair complete" : " · chair unavailable"}</div>{aiCommittee.chair && <article className="ai-voice ai-chair"><div className="voice-heading"><span className="voice-avatar voice-chair">C</span><div><span className="small-overline">GOOGLE AI MODE · SYNTHESIS</span><h4>Committee chair</h4></div></div><p className="ai-summary">{aiCommittee.chair.summary}</p><AICitationLinks citations={aiCommittee.chair.summaryCitations} />{aiCommittee.chair.points.length > 0 && <ul>{aiCommittee.chair.points.map((point, index) => <li key={index}><span>{point.text}</span><AICitationLinks citations={point.citations} /></li>)}</ul>}</article>}<div className="ai-voice-grid">{aiCommittee.voices.map(voice => <article className="ai-voice" key={voice.role}><div className="voice-heading"><span className={`voice-avatar voice-${voice.role.toLowerCase()}`}>{voice.role[0]}</span><div><span className="small-overline">GOOGLE AI MODE</span><h4>{voice.role}</h4></div></div><p className="ai-summary">{voice.summary}</p><AICitationLinks citations={voice.summaryCitations} />{voice.points.length > 0 && <ul>{voice.points.map((point, index) => <li key={index}><span>{point.text}</span><AICitationLinks citations={point.citations} /></li>)}</ul>}<div className="ai-references"><strong>AI MODE REFERENCES</strong>{voice.references.length ? voice.references.map(citation => <a key={citation.url} href={citation.url} target="_blank" rel="noopener noreferrer" title={citation.title}>{citation.domain}<ArrowUpRight size={12} /></a>) : <span>No references returned</span>}</div></article>)}</div></>}</section>
            <div className="voice-grid"><div className="baseline-heading"><span className="small-overline">SOURCE-LED BASELINE</span><h3>Rule-based committee</h3></div>{run.committee.voices.map(voice => <section className="data-panel voice-card" key={voice.role}><div className="voice-heading"><span className={`voice-avatar voice-${voice.role.toLowerCase()}`}>{voice.role[0]}</span><div><span className="small-overline">COMMITTEE VIEW</span><h3>{voice.role}</h3></div></div><p className="voice-observation">{voice.observation}</p><div className="voice-sources">{voice.evidenceIds.length ? voice.evidenceIds.map(id => <EvidenceLink key={id} item={evidenceById.get(id)} />) : <span>No cited result in this run</span>}</div><div className="voice-question"><span>QUESTION TO TEST</span><p>{voice.nextQuestion}</p></div></section>)}</div>
          </div> : activeTab === "memo" ? <InvestmentMemo run={run} ai={aiCommittee} /> : <section className="data-panel evidence-panel"><div className="data-panel-heading"><div><span className="small-overline">SOURCE TRAIL</span><h3>Evidence library</h3></div><span className="count-badge">{run.evidence.length} results</span></div><p className="panel-disclaimer">These are search and news result previews. Read the original pages to confirm claims.</p><div className="evidence-list">{run.evidence.map(item => <a href={item.url} target="_blank" rel="noopener noreferrer" className="evidence-row" key={item.id}><span className={`evidence-kind ${item.kind}`}>{item.kind === "news" ? "NEWS" : "SEARCH"}</span><div><strong>{item.title}</strong><p>{item.snippet || "Preview unavailable"}</p><small>{item.domain}{item.publishedAt ? ` · ${item.publishedAt}` : ""}</small></div><ExternalLink size={17} /></a>)}</div></section>}
          <div className="trust-note"><Check size={16} /><span><strong>Evidence standard:</strong> “Confirmed” means a cited result explicitly reports the headline; it does not mean the underlying claim was independently verified. “Inferred” means extracted or interpreted from a preview. Missing private-company data remains unavailable.</span></div>
        </> : <div className="pre-run"><div className="pre-run-icon"><Radar size={27} /></div><div><strong>Ready when you are</strong><p>Run the sample EV battery recycling thesis or enter your own to see live company, news, and risk signals here.</p></div><div className="pre-run-lines" aria-hidden="true"><span /><span /><span /></div></div>}
      </main>
    </div>

    {company && <div className="drawer-backdrop" onClick={() => setSelectedCompany(null)}><aside className="company-drawer" onClick={e => e.stopPropagation()} aria-label="Company evidence detail"><button className="drawer-close" onClick={() => setSelectedCompany(null)} aria-label="Close"><X size={19} /></button><span className="small-overline">FOCUSED COMPANY RESEARCH</span><h2>{company.name}</h2><Status value={company.nameStatus} /><p className="drawer-intro">Search-result evidence is a starting point for diligence. Company identity, funding, and traction need direct verification.</p>{deepDivePending && <div className="drawer-loading"><LoaderCircle size={17} className="spin" /> Searching company-specific sources…</div>}{deepDiveError && <div className="drawer-error"><CircleAlert size={16} />{deepDiveError}</div>}{deepDive && <><div className="drawer-time"><Clock3 size={13} /> Searched {new Date(deepDive.searchedAt).toLocaleString()}</div>{deepDive.warnings.length > 0 && <div className="drawer-error"><CircleAlert size={16} />{deepDive.warnings.join(" · ")}</div>}{deepDive.fields.map(field => <div className="drawer-field" key={field.label}><span>{field.label.toUpperCase()}</span><p>{field.value} <Status value={field.status} /></p>{field.evidenceId && <EvidenceLink item={deepDiveEvidence.get(field.evidenceId)} />}</div>)}<div className="drawer-field"><span>QUESTIONS FOR FOUNDERS</span><ul className="diligence-questions">{deepDive.questions.map(question => <li key={question}>{question}</li>)}</ul></div><div className="drawer-field"><span>COMPANY-SPECIFIC SOURCES</span>{deepDive.evidence.filter(item => `${item.title} ${item.snippet}`.toLowerCase().includes(company.name.toLowerCase())).slice(0, 8).map(item => <div className="drawer-source" key={item.id}><strong>{item.title}</strong><EvidenceLink item={item} /></div>)}</div></>}{!deepDive && !deepDivePending && <div className="drawer-field"><span>ORIGINAL SEARCH PREVIEW</span><p>{company.description}</p>{company.evidenceIds.map(id => <EvidenceLink key={id} item={evidenceById.get(id)} />)}</div>}</aside></div>}
  </div>;
}
