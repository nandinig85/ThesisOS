import test from "node:test";
import assert from "node:assert/strict";
import { parseAIMode } from "../lib/ai-mode-extract.ts";

test("AI Mode paragraphs and list items keep their own safe source references", () => {
  const result = parseAIMode({
    references: [
      { index: 7, title: "Policy source", link: "https://example.org/policy" },
      { index: 8, title: "Unsafe", link: "javascript:alert(1)" },
      { index: 9, title: "Market source", link: "https://market.example/report" },
    ],
    text_blocks: [
      { type: "paragraph", snippet: "The market is developing, but demand remains uncertain.", reference_indexes: [7] },
      { type: "list", list: [
        { title: "Demand", snippet: "Recycling demand may grow over several years.", reference_indexes: [9, 8] },
        { title: "Risk", snippet: "Rules may change as collection targets rise.", reference_indexes: [7] },
      ] },
    ],
  }, "Market");

  assert.ok(result);
  assert.equal(result.summary, "The market is developing, but demand remains uncertain.");
  assert.equal(result.points.length, 2);
  assert.equal(result.points[0].citations[0].domain, "market.example");
  assert.equal(result.points[1].citations[0].url, "https://example.org/policy");
  assert.equal(result.references.length, 2);
});

test("AI Mode response without text blocks has no usable perspective", () => {
  assert.equal(parseAIMode({ references: [{ link: "https://example.org" }] }, "Bear"), null);
});

test("AI Mode skips headings and follow-up prompts, and cleans math formatting", () => {
  const result = parseAIMode({
    references: [{ index: 0, link: "https://example.org/rules" }],
    text_blocks: [
      { type: "paragraph", snippet: "Policy or Market Shifts altering the thesis:" },
      { type: "paragraph", snippet: "BatX Energies secured new funding but private economics remain unavailable." },
      { type: "paragraph", snippet: "EPR rules target $80\\%$ recovery in 2025–26; verify the exact requirement in the cited rule.", reference_indexes: [0] },
      { type: "paragraph", snippet: "Let me know how you want to proceed with this valuation framework." },
    ],
  }, "Regulatory");
  assert.ok(result);
  assert.match(result.summary, /^EPR rules target 80%/);
  assert.equal(result.points.length, 1);
});

test("AI Mode reads cited facts inside nested research lists before diligence questions", () => {
  const result = parseAIMode({
    references: [{ index: 4, title: "Official initiative", link: "https://example.org/initiative" }],
    text_blocks: [
      { type: "list", list: [{ text_blocks: [
        { type: "heading", snippet: "Market structure" },
        { type: "list", list: [
          { snippet: "Confirmed Facts: An official initiative allocated funding to battery recycling research in India.", reference_indexes: [4] },
          { snippet: "Inferences: Customer demand may expand, but actual contracts remain unavailable." },
        ] },
      ] }] },
      { type: "heading", snippet: "Diligence questions" },
      { type: "list", list: [{ snippet: "What is the actual feedstock cost per kilogram for this company?" }] },
    ],
  }, "Market");
  assert.ok(result);
  assert.match(result.summary, /^AI Mode claim with citation:/);
  assert.equal(result.references.length, 1);
  assert.equal(result.points.length, 1);
  assert.doesNotMatch(result.summary, /What is the actual/);
});
