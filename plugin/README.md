# Parvenu plugin for OpenClaw

B2B lead sourcing and enrichment as native OpenClaw tools: build lead lists
with verified emails, find a person's work email, enrich LinkedIn profiles and
search companies. Calls are billed in credits on your own Parvenu account.

## Install

```bash
openclaw plugins install @parvenudev/openclaw-parvenu
```

Add your API key (from your account at app.parvenu.io) to `openclaw.json`:

```json5
{
  plugins: {
    entries: {
      parvenu: { enabled: true, config: { apiKey: "YOUR_PARVENU_API_KEY" } },
    },
  },
}
```

If `apiKey` is empty, the plugin uses the `PARVENU_API_KEY` environment variable.

## Tools

| Tool | What it does | Cost |
|---|---|---|
| `parvenu_credit_check` | Credit balance | Free |
| `parvenu_all_lists` | Lists on the account | Free |
| `parvenu_search_lead_locations` | Valid location values for lead lists | Free |
| `parvenu_lead_list_start` | Start a lead list by title, industry, size, location | 1 credit per valid email (0.2 per record without emails) |
| `parvenu_list_status` | Check whether a list job is done | Free |
| `parvenu_list_download` | Download list rows, 500 per page | Free |
| `parvenu_email_lookup` | One person's work email | 1 credit when found, misses free |
| `parvenu_linkedin_profile` | Enrich one LinkedIn profile | 1 credit |
| `parvenu_company_search` | Search companies | 0.2 credits per company |

Requests go only to `https://api.parvenu.io`, are spaced to stay under the
5-requests-per-second limit, and never log or return the API key.

## Example prompts

- "Find 50 owners of California roofing companies with 11–50 employees, with verified emails."
- "What's the work email for https://www.linkedin.com/in/example?"
- "Find US cybersecurity companies with 51–200 employees."

## Develop

```bash
npm install --ignore-scripts   # openclaw's install script requires Node >= 24.16
npm run build                  # compiles src/ to dist/
npx openclaw plugins build     # regenerates openclaw.plugin.json from dist/index.js (Node >= 24.16)
npx openclaw plugins validate
```

`openclaw.plugin.json` is generated from the tool definitions in `src/index.ts`;
after changing tools, rebuild and rerun `openclaw plugins build` rather than
editing the tool list by hand. `categories` and `uiHints` are kept.

More: https://developer.parvenu.io · https://parvenu.io
