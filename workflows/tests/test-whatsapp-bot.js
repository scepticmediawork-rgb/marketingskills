// Runs Step 2 + Step 3 of whatsapp-auto-reply.json on sample WhatsApp
// webhook payloads and prints which reply each person would get.
// Run: node workflows/tests/test-whatsapp-bot.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const wf = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "whatsapp-auto-reply.json"), "utf8"));
const codeOf = (prefix) => wf.nodes.find((n) => n.name.startsWith(prefix)).parameters.jsCode;
// Pretend to be n8n. `memory` stands in for n8n's saved workflow data.
let memory = {};
const run = (code, items) =>
  new Function("$input", "$getWorkflowStaticData", code)(
    { all: () => items, first: () => items[0] },
    () => memory
  );

// Build a payload shaped like the ones Meta sends.
function payload(message, name = "Priya Sharma") {
  return {
    body: {
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: "919800000000", phone_number_id: "123456789" },
        contacts: message ? [{ profile: { name }, wa_id: "919811111111" }] : undefined,
        messages: message ? [{ from: "919811111111", id: "wamid.X", timestamp: "1", ...message }] : undefined,
        statuses: message ? undefined : [{ status: "delivered" }],
      } }] }],
    },
  };
}
const text = (body) => ({ type: "text", text: { body } });
const tap = (id, title) => ({ type: "interactive", interactive: { type: "list_reply", list_reply: { id, title } } });

const cases = [
  ["Says hi", text("Hi"), "welcome"],
  ["Asks price with a greeting", text("hello, how much for SEO?"), "pricing"],
  ["Taps 'Our services' in the menu", tap("services", "Our services"), "services"],
  ["Asks for website/Instagram", text("send your instagram"), "website"],
  ["Wants a call", text("Can we book a call tomorrow"), "book"],
  ["Wants a person", text("I want to talk to someone"), "human"],
  ["Sends a photo", { type: "image", image: { id: "img1" } }, "notText"],
  ["Types gibberish", text("qwerty zzz"), "notUnderstood"],
  ["Says thanks (no reply, saves a free message)", text("Thank you!"), "noReply"],
  ["Sends only an emoji (no reply)", text("👍"), "noReply"],
];

for (const [label, message, expected] of cases) {
  const read = run(codeOf("Step 2"), [{ json: payload(message) }]);
  assert.strictEqual(read.length, 1, label + ": message should be read");
  const [r] = run(codeOf("Step 3"), read).map((i) => i.json);
  console.log("=".repeat(70));
  console.log(`${label}  ->  topic: ${r.topic}   wants a person: ${r.wantsHuman}   sent as: ${r.send ? r.whatsappBody.type : "nothing"}`);
  console.log(r.send ? r.replyText.replace(/^/gm, "  | ") : "  (no reply sent)");
  assert.strictEqual(r.topic, expected, label);
  assert.strictEqual(r.phoneNumberId, "123456789");
  if (!r.send) { assert.strictEqual(r.whatsappBody, null); continue; }
  assert.strictEqual(r.whatsappBody.to, "919811111111");
  assert.strictEqual(r.phoneNumberId, "123456789");
  if (r.whatsappBody.type === "interactive") {
    const rows = r.whatsappBody.interactive.action.sections[0].rows;
    assert.ok(rows.length >= 1 && rows.length <= 10, "1-10 menu rows");
    rows.forEach((row) => assert.ok(row.title.length <= 24, "row title <= 24 chars"));
    assert.ok(r.whatsappBody.interactive.body.text.length <= 1024);
  }
}
console.log("=".repeat(70));

// Delivery/read receipts must NOT trigger a reply (otherwise the bot loops).
assert.strictEqual(run(codeOf("Step 2"), [{ json: payload(null) }]).length, 0, "status updates are ignored");
console.log("Status updates ignored: OK");

// Free-limit: the counter only counts replies actually sent.
const sentSoFar = cases.filter((c) => c[2] !== "noReply").length;
assert.strictEqual(memory.repliesSent, sentSoFar, "counter counts sent replies only");
console.log(`Counter after the samples: ${memory.repliesSent} replies (the 'no reply' ones not counted): OK`);

// At the limit, the bot goes quiet and flags the chat for a person.
memory.repliesSent = 900;
const [capped] = run(codeOf("Step 3"), run(codeOf("Step 2"), [{ json: payload(text("price?")) }])).map((i) => i.json);
assert.strictEqual(capped.send, false, "no reply once the free limit is reached");
assert.strictEqual(capped.wantsHuman, true, "capped chats are handed to a person");
assert.strictEqual(memory.repliesSent, 900, "counter does not grow when nothing is sent");
console.log("At 900 replies this month the bot stops sending and flags the chat for you: OK");

// New month resets the counter.
memory.month = "2000-01";
const [nextMonth] = run(codeOf("Step 3"), [{ json: { from: "1", text: "hi", messageType: "text" } }]).map((i) => i.json);
assert.strictEqual(nextMonth.send, true);
assert.strictEqual(memory.repliesSent, 1);
console.log("Counter resets each month: OK");
memory = {};

// Every menu option must have a matching reply.
const [menuCheck] = run(codeOf("Step 3"), [{ json: { from: "1", text: "hi", messageType: "text" } }]).map((i) => i.json);
for (const row of menuCheck.whatsappBody.interactive.action.sections[0].rows) {
  const [r] = run(codeOf("Step 3"), [{ json: { from: "1", choiceId: row.id, messageType: "interactive" } }]).map((i) => i.json);
  assert.strictEqual(r.topic, row.id, `menu option "${row.id}" has no reply`);
}
console.log("Every menu option has a reply: OK");

// Placeholders still present? Remind, don't fail.
const left = (codeOf("Step 3").match(/FILL_IN/g) || []).length;
console.log(left ? `\nReminder: ${left} FILL_IN placeholders still to replace in Step 3.` : "\nNo placeholders left.");
console.log("All WhatsApp checks passed.");
