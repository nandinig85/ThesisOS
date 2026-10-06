import assert from "node:assert/strict";
import test from "node:test";
import { assembleRun, companyName, normalizeResults } from "../lib/extract.ts";
import { buildCommittee } from "../lib/committee.ts";

const thesis = { sector: "EV battery recycling", geography: "India", stage: "Seed–Series A", thesis: "" };

test("normalizes only usable, safe, deduplicated source links", () => {
  const evidence = normalizeResults({ organic_results: [
    { title: "VoltLoop raises funding", link: "https://example.com/voltloop", snippet: "VoltLoop raised $10 million." },
    { title: "Duplicate", link: "https://example.com/voltloop?ref=search" },
    { title: "Unsafe", link: "javascript:alert(1)" },
    { link: "https://example.com/no-title" },
  ] }, "search", "query");
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].domain, "example.com");
  assert.ok(evidence.every(item => item.url.startsWith("https://")));
});

test("different links get different evidence IDs even when URL prefixes match", () => {
  const evidence = normalizeResults({ news_results: [
    { title: "Story one", link: "https://www.publisher-one.com/a" },
    { title: "Story two", link: "https://www.publisher-two.com/b" },
  ] }, "news", "query");
  assert.notEqual(evidence[0].id, evidence[1].id);
});

test("private funding is unavailable unless a source preview mentions it", () => {
  const evidence = normalizeResults({ organic_results: [
    { title: "VoltLoop raises funding", link: "https://example.com/voltloop", snippet: "VoltLoop works on battery recycling." },
  ] }, "search", "query");
  const run = assembleRun(thesis, evidence, [], []);
  assert.equal(run.startups.length, 1);
  assert.equal(run.startups[0].nameStatus, "inferred");
  assert.equal(run.startups[0].fundingStatus, "unavailable");
});

test("risk interpretations stay inferred and retain source references", () => {
  const evidence = normalizeResults({ news_results: [
    { title: "New regulation for EV battery recycling in India", link: "https://news.example.com/policy", date: new Date().toISOString(), source: { name: "Example News" } },
  ] }, "news", "query");
  const run = assembleRun(thesis, evidence, [], []);
  assert.equal(run.developments[0].status, "confirmed");
  assert.equal(run.risks[0].status, "inferred");
  assert.equal(run.risks[0].evidenceId, evidence[0].id);
  assert.match(run.risks[0].marketEffect, /compliance costs/);
  assert.match(run.risks[0].thesisImplication, /Seed–Series A EV battery recycling companies in India/);
});

test("an opinion headline is not presented as an enacted rule", () => {
  const evidence = normalizeResults({ news_results: [
    { title: "Opinion: India's battery recycling norms must evolve with technology", link: "https://news.example.com/opinion", date: new Date().toISOString() },
  ] }, "news", "EV battery recycling India policy");
  const risk = assembleRun(thesis, evidence, [], []).risks[0];
  assert.match(risk.marketEffect, /does not establish that a rule has changed/);
  assert.match(risk.thesisImplication, /verify the current rule/);
});

test("a thin risk preview leaves the market consequence unavailable", () => {
  const evidence = normalizeResults({ news_results: [
    { title: "Risk looms for India's EV battery recycling sector", link: "https://news.example.com/vague", date: new Date().toISOString() },
  ] }, "news", "EV battery recycling India risk");
  const risk = assembleRun(thesis, evidence, [], []).risks[0];
  assert.equal(risk.status, "unavailable");
  assert.match(risk.marketEffect, /no defensible market effect/);
});

test("stock-picking listicles do not become venture thesis risks", () => {
  const evidence = normalizeResults({ news_results: [
    { title: "3 stocks positioning for India's stricter battery recycling norms", link: "https://news.example.com/stocks", date: new Date().toISOString() },
    { title: "India's battery recycling norms must evolve with tech", link: "https://news.example.com/norms", date: new Date().toISOString() },
  ] }, "news", "EV battery recycling India policy");
  const run = assembleRun(thesis, evidence, [], []);
  assert.equal(run.risks.length, 1);
  assert.match(run.risks[0].title, /must evolve/);
});

test("does not attribute a different company's funding or geography", () => {
  const evidence = normalizeResults({ organic_results: [
    { title: "Li Industries Raises $7 Million in Series A Funding", link: "https://example.com/li", snippet: "Li Industries develops battery recycling technology. India-based lithium-ion battery recycling startup BatX Energies raised $1.6 million in a seed round." },
    { title: "Hans Eric Melin's Post", link: "https://linkedin.com/posts/example", snippet: "Battery recycling startup raises capital." },
  ] }, "search", "query");
  const run = assembleRun(thesis, evidence, [], []);
  assert.equal(run.startups.length, 1);
  assert.equal(run.startups[0].name, "Li Industries");
  assert.equal(run.startups[0].funding, "Raises $7 Million");
  assert.equal(run.startups[0].geographyStatus, "unavailable");
});

test("committee score is evidence coverage, not investment attractiveness", () => {
  const run = assembleRun(thesis, [], [], []);
  const committee = buildCommittee(run);
  assert.equal(committee.readinessScore, 0);
  assert.equal(committee.voices.length, 4);
  assert.match(committee.chair, /too thin/);
});

test("finds named companies in news without treating generic funding headlines as companies", () => {
  const evidence = normalizeResults({ news_results: [
    { title: "BatX Energies raises ₹105 crore in Series A funding", link: "https://news.example.com/batx", snippet: "BatX Energies recycles EV batteries." },
    { title: "Start-ups secure funding to drive lithium-ion battery market in India", link: "https://news.example.com/startups" },
  ] }, "news", "query");
  const run = assembleRun(thesis, evidence, [], []);
  assert.equal(run.startups.length, 1);
  assert.equal(run.startups[0].name, "BatX Energies");
  assert.equal(run.startups[0].fundingStatus, "inferred");
});

test("excludes explicitly out-of-stage companies and old headlines", () => {
  const evidence = [
    ...normalizeResults({ news_results: [
      { title: "Lohum raises $54 million in Series B funding", link: "https://news.example.com/lohum", date: new Date().toISOString() },
      { title: "India battery recycling regulation debated", link: "https://news.example.com/old", date: "2021-01-01" },
    ] }, "news", "query"),
  ];
  const run = assembleRun(thesis, evidence, [], []);
  assert.equal(run.startups.length, 0);
  assert.equal(run.developments.length, 0);
});

test("excludes IPO-stage signals from early-stage candidate lists", () => {
  const evidence = normalizeResults({ news_results: [
    { title: "Recyclekaro plans IPO amid expansion", link: "https://news.example/ipo", date: new Date().toISOString() },
  ] }, "news", "EV battery recycling India");
  const run = assembleRun(thesis, evidence, [], []);
  assert.equal(run.startups.length, 0);
});

test("candidate fields keep the exact result that supplied each claim", () => {
  const evidence = normalizeResults({ organic_results: [
    { title: "VoltLoop raises funding", link: "https://news.example/intro", snippet: "VoltLoop recycles batteries." },
    { title: "VoltLoop raises $7 million in Series A", link: "https://news.example/round", snippet: "India-based VoltLoop recycles EV batteries." },
  ] }, "search", "EV battery recycling India");
  const candidate = assembleRun(thesis, evidence, [], []).startups[0];
  assert.equal(candidate.fundingEvidenceId, evidence[1].id);
  assert.equal(candidate.stageEvidenceId, evidence[1].id);
  assert.equal(candidate.geographyEvidenceId, evidence[1].id);
});

test("groups reports of the same funded announcement into one development with both sources", () => {
  const evidence = normalizeResults({ news_results: [
    { title: "India and EU launch €15.2 million battery recycling call", link: "https://news-one.example/initiative", date: "2026-05-06" },
    { title: "India EU launch joint EV battery recycling call with EUR 15.2 million funding", link: "https://news-two.example/call", date: "2026-05-07" },
  ] }, "news", "EV battery recycling India");
  const run = assembleRun(thesis, evidence, [], []);
  assert.equal(run.developments.length, 1);
  assert.deepEqual(run.developments[0].evidenceIds, evidence.map(item => item.id));
});

test("excludes a mobility company without company-specific recycling evidence", () => {
  const evidence = normalizeResults({ news_results: [
    { title: "JBM Ecolife Secures 750 Crore EV Mobility Investment", link: "https://news.example/mobility", date: new Date().toISOString() },
  ] }, "news", "EV battery recycling India funding market");
  assert.equal(assembleRun(thesis, evidence, [], []).startups.length, 0);
});

test("keeps a recycler when a currency abbreviation separates its name and activity", () => {
  const evidence = normalizeResults({ organic_results: [
    { title: "BatX Energies Raises Rs. 105 Crore", link: "https://news.example/batx-round", snippet: "BatX Energies raises Rs. 105 crore in Series A to expand battery recycling in India." },
  ] }, "search", "EV battery recycling India funding");
  const candidate = assembleRun(thesis, evidence, [], []).startups[0];
  assert.equal(candidate.name, "BatX Energies");
  assert.equal(candidate.fundingEvidenceId, evidence[0].id);
  assert.equal(candidate.stage, "Series A");
  assert.equal(candidate.geography, "India");
});

test("another sector requires more than one generic topic word", () => {
  const evidence = normalizeResults({ organic_results: [
    { title: "SunVault raises funding", link: "https://news.example/solar", snippet: "SunVault installs solar panels for offices." },
    { title: "FrostGrid raises funding", link: "https://news.example/cold", snippet: "FrostGrid builds solar cold storage for farms in India." },
  ] }, "search", "solar cold storage India");
  const run = assembleRun({ sector: "solar cold storage", geography: "India", stage: "Seed", thesis: "" }, evidence, [], []);
  assert.deepEqual(run.startups.map(item => item.name), ["FrostGrid"]);
});

test("removes a generic business descriptor from company names", () => {
  assert.equal(companyName("Cold Storage Maker Ecozen raises funding"), "Ecozen");
});
