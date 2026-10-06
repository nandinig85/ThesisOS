import assert from "node:assert/strict";
import test from "node:test";
import { assembleRun, normalizeResults } from "../lib/extract.ts";
import { buildMemoSources } from "../lib/memo.ts";

test("memo cites used evidence once and retains direct research sources", () => {
  const evidence = normalizeResults({ news_results: [
    { title: "BatX Energies raises ₹105 crore in Series A funding", link: "https://news.example/batx", snippet: "BatX Energies recycles EV batteries.", date: new Date().toISOString() },
    { title: "Unrelated old market story", link: "https://news.example/old", date: "2020-01-01" },
  ] }, "news", "battery recycling India");
  const run = assembleRun({ sector: "EV battery recycling", geography: "India", stage: "Seed–Series A", thesis: "" }, evidence, [], []);
  run.signals.papers = [{ title: "Battery recycling paper", snippet: "", detail: "2025", url: "https://research.example/paper" }];
  run.signals.jobs = [{ title: "Battery recycling role", company: "Example", location: "India", url: "javascript:alert(1)" }];
  const refs = buildMemoSources(run);
  assert.equal(refs.sources.length, 2);
  assert.equal(refs.sources[0].url, "https://news.example/batx");
  assert.equal(refs.sources[1].url, "https://research.example/paper");
  assert.equal(refs.evidenceNumbers[evidence[0].id], 1);
  assert.equal(refs.evidenceNumbers[evidence[1].id], undefined);
});
