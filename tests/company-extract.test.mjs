import assert from "node:assert/strict";
import test from "node:test";
import { buildCompanyFields } from "../lib/company-extract.ts";
import { normalizeResults } from "../lib/extract.ts";

test("company dive prefers newer funding and a business description over old round commentary", () => {
  const evidence = [
    ...normalizeResults({ organic_results: [
      { title: "VoltLoop raises $5 million", link: "https://example.org/old", snippet: "In conclusion, VoltLoop's funding round is a milestone.", date: "2023-01-01" },
      { title: "VoltLoop company profile", link: "https://example.org/profile", snippet: "Founders Mira Shah. About the Company. VoltLoop operates a battery recycling platform in India." },
      { title: "VoltLoop ₹105 crore funding", link: "https://example.org/investor", snippet: "VoltLoop raised ₹105 crore in a Series A round led by IvyCap Ventures." },
    ] }, "search", "VoltLoop"),
    ...normalizeResults({ news_results: [
      { title: "VoltLoop raises ₹105 crore in Series A funding", link: "https://news.example/round", date: "2026-07-02" },
      { title: "VoltLoop partners with AutoCo for battery recycling", link: "https://news.example/partner", date: "2025-07-02" },
    ] }, "news", "VoltLoop"),
  ];
  const fields = buildCompanyFields("VoltLoop", "EV battery recycling", "India", evidence);
  const byLabel = Object.fromEntries(fields.map(field => [field.label, field]));
  assert.match(byLabel["Product / activity preview"].value, /operates a battery recycling platform/);
  assert.match(byLabel["Latest funding mention"].value, /₹105 crore/);
  assert.equal(byLabel["Latest funding mention"].evidenceId, evidence[3].id);
  assert.equal(byLabel["Founder mention"].value, "Mira Shah");
  assert.equal(byLabel["Investor tied to funding mention"].value, "IvyCap Ventures");
  assert.equal(byLabel["Partnership headline"].status, "confirmed");
  assert.equal(byLabel["Customer traction"].status, "unavailable");
});
