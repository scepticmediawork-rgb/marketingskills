# Rules Brain (no AI) for n8n

A free replacement for the Agency OS "Brain" sub-workflow. It scores and drafts using rules you write, so nothing is sent to Anthropic or any other AI provider. Running it costs nothing.

| File | What it is |
|------|------------|
| `rules-brain.json` | The **Rules Brain (no AI)** sub-workflow. Other workflows call it. |
| `lead-scoring.json` | A worked example. It reads unscored leads from Notion, scores them with the Rules Brain, and writes **Score**, **Tier** and **Score Reasons** back to each row. |
| `tests/test-rules-brain.js` | Runs the Brain's code on three sample leads and prints the results. |
| `whatsapp-auto-reply.json` | Instantly replies to WhatsApp messages with your services, pricing, website and page links, and a tap-to-open menu. **This one sends automatically.** Setup: [WHATSAPP-SETUP.md](WHATSAPP-SETUP.md). |
| `tests/validate-workflows.js` | Checks that every workflow JSON file is valid and wired correctly. |
| `tests/test-whatsapp-bot.js` | Runs the WhatsApp bot on sample messages and prints each reply. |

The Rules Brain and lead-scoring workflows never send email, post or publish anything. They only prepare scores and drafts for you to review. The WhatsApp workflow is the exception: it auto-replies, as requested, but only with the fixed text you write and only to people who messaged you first.

---

## 1. Import the Rules Brain first

1. Open n8n at http://localhost:5678.
2. Click **Create workflow** (or **+** → **Workflow**).
3. Open the **⋯** menu (top right) → **Import from File…** → pick `rules-brain.json`.
4. Click **Save**.
5. Look at the browser address bar. It ends in `/workflow/SOMETHING`. **Copy that `SOMETHING`.** This is the Rules Brain's workflow ID. You need it in step 2.

**Credentials:** none. The Rules Brain makes no outside calls.

**Try it:** click **Test workflow**. The two nodes marked *(test only)* feed a sample lead into Step 2. Click Step 2 to see `score`, `tier`, `reasons` and `draft`.

## 2. Import the lead-scoring example

1. Create another new workflow and import `lead-scoring.json`, the same way as before.
2. Set up each node:

| Node | What to do |
|------|------------|
| **Step 2 - Settings** | Replace `PASTE_YOUR_NOTION_DATABASE_ID_HERE` with your database ID. That's the 32-character code in the database's Notion link, before any `?v=`. |
| **Step 3 - Get unscored leads from Notion** | Under **Credential for Notion API**, pick your existing *Notion API* credential. |
| **Step 4 - Turn Notion rows into facts** | Only needed if your column names differ from the defaults. See section 4. Also fill in `sender_name`, `booking_link` and `resources_link` if you want them in drafts. |
| **Step 5 - Score with Rules Brain** | Set **Source** to *Database* and paste the Rules Brain workflow ID from part 1 into **Workflow ID**. |
| **Step 7 - Write score back to Notion** | Pick the same *Notion API* credential. |

3. Click **Save**.

### Set up your Notion database

1. Open the database in Notion → **⋯** → **Connections** → add your integration. Without this, the Notion API returns "object not found".
2. Make sure it has these columns. Names must match exactly, including capital letters:

| Column | Type | Used for |
|--------|------|----------|
| Name | Title | read |
| Email | Email | read |
| Company | Text | read |
| Company Size | Number, Text or Select (for example `250` or `51-200`) | read |
| Budget | Number or Text (for example `5000` or `$2k-$5k`) | read |
| Role | Text | read |
| Timeline | Text or Select | read |
| Source | Select | read |
| Message | Text | read |
| **Score** | **Number** | written by Step 7 |
| **Tier** | **Select** | written by Step 7 (Notion creates the options itself) |
| **Score Reasons** | **Text** | written by Step 7 |

### Run it

Click **Test workflow**. Only rows with an empty **Score** are picked up, up to 50 per run. Run it again to score the next 50. Clear a row's Score to have it re-scored.

**Step 1 (optional) - Run every hour** only runs once you switch the workflow to **Active**. Leave it off if you prefer to run it by hand.

---

## 3. Editing the rule packs (no JavaScript needed)

Open **Rules Brain (no AI)** → double-click **Step 2 - Apply rules and fill template**. The top of the code has two clearly marked sections.

### RULE PACKS

Each pack has a name (for example `lead_scoring`) and a list of rules. One rule is one line:

```js
{ fact: "budget", check: "atLeast", value: 5000, points: 25, reason: "Budget is 5,000 or more" },
```

- **fact** is the field name inside `facts`.
- **check** is one of `isPresent`, `isMissing`, `equals`, `isOneOf`, `containsAny`, `containsNone`, `atLeast`, `atMost` or `between`.
- **value** is what to compare against: a number, `"text"`, or a list `["a", "b"]`. For `between`, use `[low, high]`.
- **points** are added when the check passes. Use a minus number to subtract.
- **reason** is the sentence shown in *Score Reasons* when the check passes.

Other settings in each pack:

- **startScore** is where every item starts.
- **tiers** are score bands, checked from the top down.
- **mustHave** lists facts the Brain needs before it can judge. If any are missing, the tier becomes **Needs info** instead of a score band. That way a lead is never marked Cold just because you don't know its budget yet.
- **templateByTier** / **template** choose which draft to write.

**Common edits:**
- Change a number: `value: 5000` → `value: 3000`.
- Change a weight: `points: 25` → `points: 30`.
- Add a rule: copy an existing line, paste it below, and change it. Keep the comma at the end.
- Remove a rule: delete the line, or put `//` in front of it.
- Add a whole new pack: copy the `client_health: { ... },` block, rename it, and edit it. Callers then use `ruleset: "your_new_name"`.

Rules add up. If a fact matches two rules, both count. The final score is capped between 0 and 100.

### TEMPLATES

Write the draft text and put fact names in double curly braces: `Hi {{name}},`. You can also use `{{score}}`, `{{tier}}` and `{{task}}`. Use `\n` for a new line.

Any fact the Brain doesn't have appears as **DATA NEEDED**. The Brain never fills gaps with guesses.

After editing, click **Execute step** (or **Test workflow**). A mistake like a missing comma or quote shows up as a red error naming the line.

### How numbers are read

- `"5,000"` → 5000
- `"$1.5k"` → 1500
- `"200+"` → 200
- A range like `"11-50"` or `"$2k - $5k"` → the middle of the range (30.5 or 3500)
- Text with no number (for example `"ten"`) counts as "could not check". It adds no points and is listed as DATA NEEDED in the reasons.

---

## 4. Calling the Rules Brain from your other workflows

Add an **Execute Workflow** node, point it at the Rules Brain, and send items shaped like this:

```json
{ "task": "Score inbound lead", "ruleset": "lead_scoring", "facts": { "name": "…", "budget": 5000 } }
```

Optional: add `"template": "some_template_name"` to override the pack's template.

Each item comes back with everything you sent, plus:

- `scored`: `false` if the rule pack name was not found
- `score`
- `tier`
- `reasons`
- `draft`

If your Notion columns have different names, edit the `COLUMN_TO_FACT` list at the top of **Step 4** in the lead-scoring workflow. The left side is your Notion column; the right side is the fact name the rules use.

---

## 5. Checking the files yourself

These need Node.js 18 or later and no packages:

```bash
node workflows/tests/validate-workflows.js   # both JSON files parse and are wired correctly
node workflows/tests/test-rules-brain.js     # scores 3 sample leads and prints the results
```

The test runs the exact code stored inside `rules-brain.json`. If you edit the rules in n8n and want to re-test, export the workflow over `rules-brain.json` first.

---

## Notes

- **Notion API version:** the HTTP nodes send `Notion-Version: 2022-06-28`, which is the version that supports the `databases/{id}/query` endpoint used here. If you later move to Notion's newer "data sources" API, you must change both the header and the Step 3 URL.
- **Execute Workflow node:** the lead-scoring example uses n8n's core **Execute Workflow** node (Step 5) to call the Brain. The Execute Workflow Trigger only receives calls; this node is the one that makes them.
- **Access:** the Rules Brain only accepts calls from workflows owned by the same n8n user (Settings → *This workflow can be called by*).
