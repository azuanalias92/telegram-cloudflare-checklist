# Telegram Checklist Bot (Cloudflare Workers)

A lightweight Cloudflare Worker that posts a daily checklist to Telegram and lets you tick items via inline buttons. Lists live in Cloudflare KV; you can manage them with simple chat commands.

**Features**
- Store checklists in Cloudflare KV with per-date keys
- Inline buttons to mark tasks done in place
- Chat commands: add, remove, and list items
- Scheduled cron to push the day’s checklist automatically

**Requirements**
- Node.js 18+
- A Cloudflare account with access to KV
- A Telegram Bot token and your chat ID

**Quick Start**
- Install dependencies

```bash
npm install
```

- Create or link a KV namespace and update wrangler.toml with its id

```bash
npx wrangler kv namespace create CHECKLIST_KV
```

- Add secrets for Telegram

```bash
npx wrangler secret put TG_BOT_TOKEN
npx wrangler secret put TG_CHAT_ID
```

- Deploy

```bash
npx wrangler deploy
```

- Set your Telegram webhook to the Worker URL printed after deploy

```bash
curl -X POST https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<your-worker-subdomain>.workers.dev/"}'
```

**Usage**
- Add a checklist for a specific date

```text
/addlist YYYY-MM-DD Task1;Task2;Task3
```

- Remove a checklist for a date

```text
/removelist YYYY-MM-DD
```

- Show a checklist for a date

```text
/list YYYY-MM-DD
```

When a checklist is sent, each item appears with a button. Tap a button to mark it as done; the message updates inline.

**Daily Fallback**
- If there is no checklist for today’s date, the Worker looks for a weekday key: `checklist:sun|mon|tue|wed|thu|fri|sat`
- You can prefill these via KV, for example:

```bash
npx wrangler kv key put checklist:mon --binding CHECKLIST_KV --value '["Task A","Task B"]'
```

**Cron Schedule**
- Current schedule is every 5 minutes for easy testing: see crons in wrangler.toml
- For a once-a-day morning reminder, change to `0 8 * * *`

**Local Development**
- Run the Worker locally

```bash
npx wrangler dev
```

- KV state persists under `.wrangler/`. This directory is local-only and should be ignored by git.

**Configuration References**
- Worker entry: [index.ts](file:///Users/azuanalias/Desktop/Personal/telegram-cloudflare-checklist/src/index.ts)
- Runtime and KV binding: [wrangler.toml](file:///Users/azuanalias/Desktop/Personal/telegram-cloudflare-checklist/wrangler.toml)

**Security**
- Keep tokens in Wrangler secrets; never commit them to git.
