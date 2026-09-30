# WhatsApp Auto-Reply (no AI): setup

`whatsapp-auto-reply.json` replies instantly to anyone who messages your agency's WhatsApp number. Each reply includes a tap-to-open menu:

| Menu option | What they get |
|-------------|---------------|
| Our services | Your list of services plus a link |
| Pricing | Your packages and starting prices |
| Our work | Case studies, Instagram and Behance |
| Website & pages | Website, Instagram, LinkedIn and Facebook links |
| Book a call | Your booking link and working hours |
| Talk to a person | "A team member will reply soon." Optionally saves them to Notion. |

People can also type instead of tapping. "price", "website" or "book a call" gets the matching reply. Anything the bot doesn't recognise gets "Sorry, I didn't catch that" plus the menu. Photos and voice notes are passed to a person.

Every reply is text **you wrote**. The bot doesn't use AI, so it never makes up prices or promises.

> ⚠️ This workflow **sends messages automatically**, unlike the other workflows in this folder. It only sends the fixed replies in Step 3, and only to people who messaged you first.

---

## What it costs

- **Meta WhatsApp Cloud API:** replies within 24 hours of a customer's message are free under Meta's current pricing. This bot only ever replies, and never starts a conversation. Meta charges for business-started "template" messages, which this bot does not send. Meta changes pricing from time to time, so check [Meta's WhatsApp pricing page](https://developers.facebook.com/docs/whatsapp/pricing) once.
- **Cloudflare Tunnel:** free.
- **n8n:** your own install, so free.

It uses Meta's **official** API. It does not use "WhatsApp Web" automation tricks, which break WhatsApp's rules and can get your number banned.

---

## Step A: Make your n8n reachable from the internet

Meta has to deliver messages to your n8n, and it can't reach `localhost`. A free Cloudflare Tunnel gives your computer a public `https://` address.

1. Install `cloudflared`: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Run:
   ```bash
   cloudflared tunnel --url http://localhost:5678
   ```
   It prints an address like `https://random-words.trycloudflare.com`. Keep this window open.
3. Tell n8n its public address by setting `WEBHOOK_URL`, then restart n8n.
   - **npm / npx:** `WEBHOOK_URL=https://random-words.trycloudflare.com/ n8n start`
   - **Docker:** add `-e WEBHOOK_URL=https://random-words.trycloudflare.com/` to your `docker run` command, or put it under `environment:` in docker-compose.

**Important:** a quick tunnel gets a **new address every time you restart it**, and you then have to repeat Step D. For something permanent, create a *named* Cloudflare Tunnel on your own domain. That's free with a Cloudflare account; see Cloudflare's "Create a remotely-managed tunnel" guide. Your computer and n8n must also be running for the bot to reply.

## Step B: Create the Meta app (free)

1. Go to https://developers.facebook.com → **My Apps** → **Create App** → choose **Business** (or the "Connect with customers through WhatsApp" use case).
2. Add the **WhatsApp** product. Meta gives you a free **test phone number** to start with.
3. Open **WhatsApp → API Setup**. Note:
   - the **Phone number ID** (you don't need to type this anywhere, because the workflow reads it from each message)
   - a **temporary access token**, which only lasts 24 hours and is only for testing
   - the **To** list. Add your own mobile here. The test number can only message up to 5 numbers you add.
4. **Permanent token**, for real use:
   1. Go to https://business.facebook.com → **Settings** → **Users** → **System users** → **Add** (role: Admin).
   2. Choose **Assign assets**, pick your app and give it full control.
   3. Choose **Generate new token**, pick your app, and tick `whatsapp_business_messaging` and `whatsapp_business_management`. Set expiry to **Never** if offered.
   4. Copy the token and keep it private.
5. **Going live with your real number:** in **API Setup**, choose **Add phone number** and verify it by SMS or call. A number registered here normally can't stay logged into the regular WhatsApp app at the same time. Meta has been rolling out "coexistence" for WhatsApp Business app numbers; check whether it's offered when you add yours. Start with the test number until everything works.

## Step C: Import and fill in the workflow

1. In n8n, create a new workflow, then **⋯ → Import from File…** → `whatsapp-auto-reply.json`.
2. **Step 0b - Is the verify token right?** Change `CHANGE_ME_verify_token` to any password you make up, for example `myagency-2026-xyz`. You'll type the same value into Meta in Step D.
3. **Step 3 - Choose the reply.** Replace every `FILL_IN` with your agency name, website, page links, services, prices and booking link. See "Editing the replies" below.
4. **Step 4 - Send reply on WhatsApp.** Under **Credential for Header Auth**, choose **Create new**:
   - **Name:** `Authorization`
   - **Value:** `Bearer YOUR_TOKEN`. That's the word Bearer, a space, then your token from Step B.
5. **Optional: save "talk to a person" leads to Notion.**
   - In **Step 3**, paste your Notion database ID into `notionLeadsDatabaseId`.
   - In **Step 6**, pick your *Notion API* credential.
   - The database needs **Name** (Title), **Phone** (Phone number), **Source** (Select) and **Message** (Text) columns. It can be your lead-scoring database, as long as you add a **Phone** column. The lead-scoring workflow will then pick these leads up. They'll usually show **Needs info** because WhatsApp doesn't give you a budget.
   - If you leave the ID blank, this step is skipped. If Notion fails, the customer still gets their reply.
6. Click **Save**, then switch the workflow to **Active** (top right).
7. Open **Step 1 - New WhatsApp message** and copy its **Production URL**. It should start with your tunnel address.

## Step D: Connect Meta to n8n

1. In your Meta app, go to **WhatsApp → Configuration → Webhook → Edit**.
2. **Callback URL:** paste the Production URL from Step C7.
3. **Verify token:** the password you set in Step 0b.
4. Click **Verify and save**. Meta calls Step 0a, and n8n answers through Step 0c. If this fails, see Troubleshooting below.
5. Under **Webhook fields**, **Subscribe** to **messages**.

## Step E: Test

From your phone (a number in the "To" list), send **hi** to the business number. You should get the welcome message and a **See options** button within a few seconds. Tap an option, then try typing "price" or "talk to someone".

In n8n, **Executions** (left sidebar) shows every run. Click one to see each step.

---

## Editing the replies

Open **Step 3 - Choose the reply**. Everything you need is at the top:

- **AGENCY:** name, website, hours, Notion database ID.
- **MENU:** the options people tap. At most 10 options, titles up to 24 characters, details up to 72 characters. Each `id` must match a reply name below it.
- **REPLIES:** what the bot says for each option, and the typed `words` that trigger it.
  - `*bold*` and `_italic_` work like normal WhatsApp formatting. `\n` starts a new line.
  - `{{name}}` becomes the person's WhatsApp first name, or "there" if they have none set.
  - **Order matters.** If a message matches several topics, the one **higher** in the list wins. That's why "hi, how much for SEO?" gets Pricing, not Services.
  - Keep each reply under 1,024 characters so the menu button can be attached. Longer replies are sent as plain text without the menu.
- **To add a new topic,** for example "Careers":
  1. Add a line to MENU: `{ id: "careers", title: "Careers", detail: "Join our team" },`
  2. Add a matching reply to REPLIES: `careers: { words: ["job", "hiring", "career"], text: "..." },`

After editing, run the test with `node workflows/tests/test-whatsapp-bot.js`. You'll need to export the workflow over the JSON file first. The test checks that every menu option has a reply and lists any `FILL_IN` left.

---

## Troubleshooting

| Problem | Likely cause |
|---------|--------------|
| Meta says "The callback URL or verify token couldn't be validated" | The workflow isn't **Active**, the tunnel window is closed, the URL is the *Test* URL instead of the *Production* URL, or the token doesn't match Step 0b exactly. |
| Executions appear but no reply arrives | Open Step 4's error. `401` means the token is wrong or expired, or is missing the `Bearer ` prefix. `131030` means your number isn't in the test "To" list. `131047` means more than 24 hours have passed since their last message. |
| Nothing appears in Executions | You didn't subscribe to the **messages** webhook field, `WEBHOOK_URL` isn't set, or the tunnel address changed. |
| Replies stopped after a restart | The quick tunnel's address changed. Update `WEBHOOK_URL` and the Meta Callback URL, or set up a named tunnel. |
| Error mentioning Graph API version | Meta retires old versions. Change `v23.0` in Step 4's URL to the version shown in Meta's API Setup page. |

## Security notes

- The webhook address ends in a random code, so it can't be guessed. Don't post it publicly.
- Treat the access token like a password. It lives only in the n8n credential, not in the workflow file.
- Meta only lets you send free-form replies to people who messaged you in the last 24 hours. So even if someone found the URL, they couldn't use it to spam strangers.
