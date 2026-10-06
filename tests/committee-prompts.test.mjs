import assert from "node:assert/strict";
import test from "node:test";
import { buildChairPrompt, buildRolePrompt } from "../lib/committee-prompts.ts";

const context = {
  thesis: { sector: "EV battery recycling", geography: "India", stage: "Seed–Series A", thesis: "What would change the thesis?" },
  evidence: [{ id: "policy", domain: "pib.gov.in" }, { id: "risk", domain: "example.org" }],
  startups: [{ name: "VoltLoop", funding: "No public amount", fundingStatus: "unavailable", geographyStatus: "unavailable" }],
  developments: [{ title: "India announces battery collection rule", category: "Policy", evidenceId: "policy" }],
  risks: [{ title: "Battery collection costs may rise in India", evidenceId: "risk" }],
};

test("role-specific research uses the current run and preserves missing data", () => {
  const bull = buildRolePrompt(context, "Bull");
  const regulatory = buildRolePrompt(context, "Regulatory");
  assert.match(bull, /VoltLoop; funding: unavailable/);
  assert.match(regulatory, /India announces battery collection rule/);
  assert.match(regulatory, /pib\.gov\.in/);
  assert.doesNotMatch(regulatory, /VoltLoop/);
});

test("chair prompt reconciles the actual completed perspectives", () => {
  const prompt = buildChairPrompt(context, [
    { role: "Market", summary: "Demand is uncertain.", points: [], references: [] },
    { role: "Bear", summary: "Collection costs may rise.", points: [], references: [] },
  ]);
  assert.match(prompt, /Market: Demand is uncertain/);
  assert.match(prompt, /Bear: Collection costs may rise/);
  assert.match(prompt, /missing evidence/);
});
