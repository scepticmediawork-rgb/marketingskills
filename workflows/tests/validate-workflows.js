// Checks every workflow JSON in /workflows:
//   - the file parses
//   - node names are unique
//   - every node named in "connections" exists
//   - settings use executionOrder v1 and timezone Asia/Kolkata
//   - only allowed node types are used
//   - Notion calls use the notionApi credential and a Notion-Version header
//   - Code nodes have valid JavaScript syntax
// Run: node workflows/tests/validate-workflows.js
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..");
const ALLOWED = new Set([
  "n8n-nodes-base.executeWorkflowTrigger",
  "n8n-nodes-base.executeWorkflow",
  "n8n-nodes-base.code",
  "n8n-nodes-base.httpRequest",
  "n8n-nodes-base.if",
  "n8n-nodes-base.set",
  "n8n-nodes-base.scheduleTrigger",
  "n8n-nodes-base.manualTrigger",
  "n8n-nodes-base.stickyNote",
]);

let failures = 0;
const fail = (file, msg) => { failures++; console.log(`  FAIL ${file}: ${msg}`); };

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  console.log(`Checking ${file}`);
  let wf;
  try {
    wf = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  } catch (e) {
    fail(file, `does not parse: ${e.message}`);
    continue;
  }
  const names = wf.nodes.map((n) => n.name);
  const nameSet = new Set(names);
  if (nameSet.size !== names.length) fail(file, "duplicate node names");

  for (const [from, outputs] of Object.entries(wf.connections || {})) {
    if (!nameSet.has(from)) fail(file, `connection from missing node "${from}"`);
    for (const branch of outputs.main || []) {
      for (const c of branch || []) {
        if (!nameSet.has(c.node)) fail(file, `connection to missing node "${c.node}"`);
      }
    }
  }

  if (wf.settings?.executionOrder !== "v1") fail(file, "executionOrder is not v1");
  if (wf.settings?.timezone !== "Asia/Kolkata") fail(file, "timezone is not Asia/Kolkata");

  let stickies = 0;
  for (const n of wf.nodes) {
    if (!ALLOWED.has(n.type)) fail(file, `node "${n.name}" uses disallowed type ${n.type}`);
    if (n.type === "n8n-nodes-base.stickyNote") { stickies++; continue; }
    if (!/^Step \d+/.test(n.name)) fail(file, `node "${n.name}" is not named "Step N - ..."`);
    if (n.type === "n8n-nodes-base.httpRequest") {
      const p = n.parameters;
      if (/anthropic|openai|googleapis\.com\/.*generative/i.test(p.url)) fail(file, `"${n.name}" calls an AI provider`);
      if (/api\.notion\.com/.test(p.url)) {
        if (p.authentication !== "predefinedCredentialType" || p.nodeCredentialType !== "notionApi")
          fail(file, `"${n.name}" does not use the notionApi credential`);
        const hasVersion = (p.headerParameters?.parameters || []).some((h) => h.name === "Notion-Version" && h.value);
        if (!hasVersion) fail(file, `"${n.name}" has no Notion-Version header`);
      }
    }
    if (n.type === "n8n-nodes-base.code") {
      try { new Function("$input", n.parameters.jsCode); }
      catch (e) { fail(file, `"${n.name}" has a JavaScript syntax error: ${e.message}`); }
    }
  }
  if (stickies !== 1) fail(file, `expected exactly 1 sticky note, found ${stickies}`);
  console.log(`  ${wf.nodes.length} nodes, ${Object.keys(wf.connections).length} connection sources`);
}

console.log(failures ? `\n${failures} problem(s) found.` : "\nAll workflow files OK.");
process.exit(failures ? 1 : 0);
