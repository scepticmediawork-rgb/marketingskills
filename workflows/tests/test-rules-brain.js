// Runs the exact code from the "Step 2" Code node in rules-brain.json
// against sample inputs and prints the results.
// Run: node workflows/tests/test-rules-brain.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const wf = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "rules-brain.json"), "utf8"));
const code = wf.nodes.find((n) => n.type === "n8n-nodes-base.code").parameters.jsCode;

// Pretend to be n8n: give the code a $input with our sample items.
function runBrain(inputs) {
  const $input = { all: () => inputs.map((json) => ({ json })) };
  return new Function("$input", code)($input).map((item) => item.json);
}

const samples = [
  {
    label: "1. Strong lead (all facts present)",
    json: {
      task: "Score inbound lead", ruleset: "lead_scoring",
      facts: {
        name: "Priya Sharma", email: "priya@acmeretail.in", company: "Acme Retail",
        company_size: "250", budget: "6,000", role: "Head of Marketing",
        timeline: "ASAP", source: "Referral", message: "a paid social retainer",
        booking_link: "https://cal.example.com/me", sender_name: "Rahul",
      },
    },
  },
  {
    label: "2. Middling lead (budget and timeline missing)",
    json: {
      task: "Score inbound lead", ruleset: "lead_scoring",
      facts: {
        name: "Arjun Mehta", email: "arjun@brightlabs.io", company: "Bright Labs",
        company_size: "11-50", role: "Marketing Manager", source: "Website form",
        message: "SEO help for our SaaS", sender_name: "Rahul",
      },
    },
  },
  {
    label: "3. Weak lead (personal email, tiny budget, junk message)",
    json: {
      task: "Score inbound lead", ruleset: "lead_scoring",
      facts: {
        name: "", email: "someone@gmail.com", company_size: 3,
        budget: "$500", role: "Student", message: "test",
      },
    },
  },
];

const results = runBrain(samples.map((s) => s.json));
results.forEach((r, i) => {
  console.log("=".repeat(70));
  console.log(samples[i].label);
  console.log(`score: ${r.score}   tier: ${r.tier}   scored: ${r.scored}`);
  console.log("reasons:");
  r.reasons.forEach((x) => console.log("  - " + x));
  console.log("draft:\n" + r.draft.replace(/^/gm, "  | "));
});
console.log("=".repeat(70));

// Sanity checks
const [hot, mid, weak] = results;
assert.ok(hot.score > mid.score && mid.score > weak.score, "scores should be ordered strong > middling > weak");
assert.strictEqual(hot.tier, "Hot");
assert.strictEqual(weak.tier, "Cold");
assert.strictEqual(mid.tier, "Needs info", "missing budget should ask, not write the lead off");
results.forEach((r) => assert.ok(r.score >= 0 && r.score <= 100, "score within 0-100"));
assert.ok(!hot.draft.includes("DATA NEEDED"), "complete lead should have no gaps");
assert.ok(mid.draft.includes("DATA NEEDED") || mid.reasons.some((x) => x.includes("DATA NEEDED")));
assert.ok(weak.draft.includes("Hi DATA NEEDED"), "missing name must not be invented");
assert.strictEqual(hot.facts.name, "Priya Sharma", "input is passed through unchanged");

// Unknown rule pack is reported, not guessed.
const [bad] = runBrain([{ task: "x", ruleset: "nope", facts: {} }]);
assert.strictEqual(bad.scored, false);
assert.strictEqual(bad.tier, "UNSCORED");

console.log("All sanity checks passed.");
