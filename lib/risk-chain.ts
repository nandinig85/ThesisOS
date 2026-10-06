import type { Evidence, Risk, ThesisInput } from "./types";

type Interpretation = Pick<Risk, "marketEffect" | "thesisImplication" | "status">;

/** The source establishes only its own preview. Every consequence below is conditional. */
export function interpretRisk(item: Evidence, thesis: ThesisInput): Interpretation {
  const text = `${item.title} ${item.snippet}`;
  const companies = `${thesis.stage} ${thesis.sector} companies in ${thesis.geography}`;

  if (/\b(opinion|editorial|must evolve|calls? for|urges?|propos(?:al|ed))\b/i.test(text) && /\b(regulat\w*|rules?|norms?|policy|compliance)\b/i.test(text)) return {
    marketEffect: "If standards change, approval timelines or compliance costs could shift. This preview does not establish that a rule has changed.",
    thesisImplication: `For ${companies}, verify the current rule and test compliance costs before treating a proposed policy change as a tailwind.`,
    status: "inferred",
  };

  if (/\b(tariffs?|import dut(?:y|ies)|export (?:ban|controls?|restrictions?))\b/i.test(text)) return {
    marketEffect: "A trade change could alter material availability or cross-border costs; the direction and size of the effect are unverified.",
    thesisImplication: `For ${companies}, test feedstock and recovered-material economics under the reported trade scenario.`,
    status: "inferred",
  };

  if (/\b(oversupply|price (?:drop|fall|decline)|falling prices?|margin compression)\b/i.test(text)) return {
    marketEffect: "Lower realized prices could compress margins if operators cannot offset them with volume or lower input costs.",
    thesisImplication: `For ${companies}, check unit economics against the price scenario before assuming attractive returns.`,
    status: "inferred",
  };

  if (/\b(fire|safety|pollution|hazard|toxic)\b/i.test(text)) return {
    marketEffect: "Safety or environmental concerns could raise operating, insurance, or compliance costs; the preview does not quantify them.",
    thesisImplication: `For ${companies}, verify permits, incident history, and the cost of meeting relevant standards.`,
    status: "inferred",
  };

  if (/\b(shortage|supply constraint|feedstock scarcity)\b/i.test(text)) return {
    marketEffect: "A supply constraint could change input availability or pricing; it may help some operators and hurt others.",
    thesisImplication: `For ${companies}, check supply agreements and sensitivity to input volume and prices.`,
    status: "inferred",
  };

  if (/\b(competition|competitor|incumbent|new capacity|capacity expansion)\b/i.test(text)) return {
    marketEffect: "Additional competitors or capacity could increase pressure for inputs, customers, or margins.",
    thesisImplication: `For ${companies}, verify differentiation and whether the market can support the reported capacity.`,
    status: "inferred",
  };

  if (/\b(lawsuit|litigation|legal challenge)\b/i.test(text)) return {
    marketEffect: "A legal dispute could create costs or delay activity; its scope is not established by this preview.",
    thesisImplication: `For ${companies}, identify which companies are affected and whether the issue reaches their operations.`,
    status: "inferred",
  };

  if (/\b(regulat\w*|rules?|norms?|policy|compliance|mandate)\b/i.test(text)) return {
    marketEffect: "Requirements may change compliance costs or demand for compliant operators. The headline alone does not establish the final rule or its impact.",
    thesisImplication: `For ${companies}, verify the rule's current status and assess each company's ability to comply.`,
    status: "inferred",
  };

  return {
    marketEffect: "Unavailable from this result preview; no defensible market effect can be assigned yet.",
    thesisImplication: `For ${companies}, read the source and establish whether this event materially changes the thesis.`,
    status: "unavailable",
  };
}
