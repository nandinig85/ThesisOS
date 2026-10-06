import assert from "node:assert/strict";
import test from "node:test";
import { normalizeJobs, normalizePatents, normalizeScholar, normalizeTrends } from "../lib/signals.ts";

test("Trends excludes the incomplete week and reports comparable relative averages", () => {
  const timeline_data = Array.from({ length: 27 }, (_, index) => ({
    date: `Week ${index + 1}`,
    values: [{ extracted_value: index < 13 ? 10 : 30 }],
    ...(index === 26 ? { partial_data: true } : {}),
  }));
  const trend = normalizeTrends({ interest_over_time: { timeline_data } }, "EV battery recycling", "India", "in");
  assert.ok(trend);
  assert.equal(trend.values.length, 26);
  assert.equal(trend.recentAverage, 30);
  assert.equal(trend.previousAverage, 10);
  assert.equal(trend.latestCompleteWeek, "Week 26");
  assert.match(trend.url, /geo=IN/);
});

test("Jobs keeps relevant listings with safe publisher links and rejects unrelated or unsafe results", () => {
  const jobs = normalizeJobs({ jobs_results: [
    { title: "Battery recycling engineer", company_name: "VoltLoop", location: "India", description: "Battery recycling process", apply_options: [{ link: "https://voltloop.example/jobs/1" }] },
    { title: "Coffee barista", company_name: "Cafe", description: "Makes coffee", apply_options: [{ link: "https://cafe.example/jobs/1" }] },
    { title: "Battery recycling engineer", company_name: "VoltLoop", location: "India", description: "Battery recycling process", apply_options: [{ link: "https://voltloop.example/jobs/1" }] },
    { title: "Battery recycling analyst", company_name: "Unsafe", description: "Battery recycling", apply_options: [{ link: "javascript:alert(1)" }] },
  ] }, "EV battery recycling");
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, "https://voltloop.example/jobs/1");
});

test("Scholar and patents retain topic-matched source links without claiming ownership", () => {
  const papers = normalizeScholar({ organic_results: [
    { title: "Battery recycling in India", link: "https://journals.example/paper", snippet: "Battery recycling technologies and challenges", publication_info: { summary: "Journal, 2025" } },
    { title: "Battery recycling forecast", link: "https://journals.example/future", snippet: "Battery recycling technologies", publication_info: { summary: "Journal, 2099" } },
    { title: "Unrelated medical paper", link: "https://journals.example/other", snippet: "Clinical trial" },
  ] }, "EV battery recycling");
  const patents = normalizePatents({ organic_results: [
    { title: "Method for battery recycling", patent_link: "https://patents.google.com/patent/IN123/en", snippet: "Battery recycling process", assignee: "Example Research Institute", publication_number: "IN123" },
    { title: "Energy recycling system", patent_link: "https://patents.google.com/patent/IN456/en", snippet: "A battery powers a driving system" },
    { title: "Method for battery recycling", patent_link: "javascript:alert(1)", snippet: "Battery recycling process" },
    { title: "Scholarly battery recycling", patent_link: "https://patents.google.com/other", snippet: "Battery recycling", is_scholar: true },
  ] }, "EV battery recycling");
  assert.equal(papers.length, 1);
  assert.equal(patents.length, 1);
  assert.match(patents[0].detail, /Example Research Institute/);
  assert.equal(patents[0].url, "https://patents.google.com/patent/IN123/en");
});
