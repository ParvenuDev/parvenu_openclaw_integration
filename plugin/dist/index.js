import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
const BASE_URL = "https://api.parvenu.io";
const MIN_GAP_MS = 220; // Parvenu allows 5 requests per second per key
const TIMEOUT_MS = 60_000;
// Serialize request starts so the gap holds even when tools run in parallel.
let queue = Promise.resolve();
function nextSlot() {
    const slot = queue.then(() => new Promise((r) => setTimeout(r, MIN_GAP_MS)));
    const ready = queue;
    queue = slot;
    return ready;
}
function result(payload, ok) {
    return {
        content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) }],
        details: { ok, result: payload },
        ...(ok ? {} : { isError: true }),
    };
}
async function callParvenu(apiKey, endpoint, body, signal) {
    if (!apiKey) {
        return result("Parvenu is not configured. Set plugins.entries.parvenu.config.apiKey in openclaw.json (or the PARVENU_API_KEY environment variable). Do not ask the user to paste the key into chat.", false);
    }
    const clean = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
    await nextSlot();
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-parvenu-source": "openclaw-plugin" },
            body: JSON.stringify({ api_key: apiKey, ...clean }),
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        const raw = await res.text();
        let data = raw;
        try {
            data = JSON.parse(raw);
        }
        catch {
            /* keep non-JSON text */
        }
        if (!res.ok)
            return result({ http_status: res.status, response: data }, false);
        return result(data, true);
    }
    catch (err) {
        const msg = timeout.aborted ? `timed out after ${TIMEOUT_MS / 1000}s` : err.message;
        return result(`Request to Parvenu failed: ${msg}`, false);
    }
}
const strList = (description) => Type.Optional(Type.Array(Type.String(), { description }));
const SIZE_BUCKETS = "Allowed: 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10001+";
const TOOLS = [
    {
        name: "parvenu_credit_check",
        endpoint: "/credit_check",
        description: "Free. Return the Parvenu credit balance for the configured account.",
        parameters: Type.Object({}),
    },
    {
        name: "parvenu_all_lists",
        endpoint: "/all_list",
        description: "Free. List the lead lists on the Parvenu account.",
        parameters: Type.Object({}),
    },
    {
        name: "parvenu_search_lead_locations",
        endpoint: "/search_lead_locations",
        description: 'Free. Look up valid values for contact_location before building a lead list, e.g. search "texas" returns "texas, us".',
        parameters: Type.Object({ search: Type.String({ description: "Place name to look up" }) }),
    },
    {
        name: "parvenu_lead_list_start",
        endpoint: "/lead_enrichment_list",
        description: "Start building a lead list (async). Costs 1 credit per valid email found (0.2 per record if email_enrichment is false). " +
            "Tell the user the likely cost and confirm before anything over ~50 credits. Then poll parvenu_list_status every 20-30s and fetch rows with parvenu_list_download. " +
            "People already in the account are skipped and not charged (unique defaults to true), so the list can be smaller than fetch_count.",
        parameters: Type.Object({
            listname: Type.String({ description: "Name for the new list" }),
            fetch_count: Type.Integer({ minimum: 1, description: "How many leads to fetch" }),
            contact_job_title: strList("Job titles to include, e.g. Owner, CEO"),
            contact_not_job_title: strList("Job titles to exclude"),
            company_keywords: strList("Company keywords to include, e.g. roofing"),
            company_not_keywords: strList("Company keywords to exclude"),
            company_industry: strList("Industries to include"),
            company_not_industry: strList("Industries to exclude"),
            company_domain: strList("Restrict to these company domains"),
            contact_location: strList('"state, country_code" with the state spelled out ("texas, us", never "TX"), or a full country name'),
            contact_not_location: strList("Locations to exclude, same format"),
            contact_city: strList("Cities to include"),
            size: strList(`Company size buckets. ${SIZE_BUCKETS}`),
            email_enrichment: Type.Optional(Type.Boolean({ description: "Find verified emails (default true)" })),
            unique: Type.Optional(Type.Boolean({ description: "Skip people already in the account (default true)" })),
        }),
    },
    {
        name: "parvenu_list_status",
        endpoint: "/check_list_status",
        description: "Free. Check whether a lead list job has finished. Poll no faster than every 20 seconds.",
        parameters: Type.Object({ listname: Type.String() }),
    },
    {
        name: "parvenu_list_download",
        endpoint: "/download_list",
        description: "Free. Download rows of a finished list, up to 500 per page; use offset for the next page.",
        parameters: Type.Object({
            listname: Type.String(),
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, default: 500 })),
            offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
        }),
    },
    {
        name: "parvenu_email_lookup",
        endpoint: "/email_enrichment",
        description: "Find one person's work email (falls back to a verified personal email, never a shared inbox). 1 credit when found, misses free. " +
            "Send person_linkedin_url when known; otherwise name plus domain or company.",
        parameters: Type.Object({
            person_linkedin_url: Type.Optional(Type.String()),
            name: Type.Optional(Type.String({ description: "Full name" })),
            domain: Type.Optional(Type.String({ description: "Company domain, e.g. acme.com" })),
            company: Type.Optional(Type.String({ description: "Company name" })),
        }),
    },
    {
        name: "parvenu_linkedin_profile",
        endpoint: "/profile",
        description: "Enrich one LinkedIn profile (title, company, history). 1 credit.",
        parameters: Type.Object({ person_linkedin_url: Type.String() }),
    },
    {
        name: "parvenu_company_search",
        endpoint: "/company_search",
        description: "Search companies by keywords, country and size. 0.2 credits per company returned; ask before pulling more pages.",
        parameters: Type.Object({
            ai_keywords: strList("What the company does, e.g. cybersecurity"),
            country_codes: strList("Two-letter country codes, e.g. us"),
            employee_buckets: strList(`Size buckets. ${SIZE_BUCKETS}`),
            page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
            page_size: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 25 })),
        }),
    },
];
export const TOOL_NAMES = TOOLS.map((t) => t.name);
export default defineToolPlugin({
    id: "parvenu",
    name: "Parvenu",
    description: "B2B lead sourcing and enrichment: lead lists with verified emails, work-email lookup, LinkedIn profiles, company search.",
    configSchema: Type.Object({ apiKey: Type.Optional(Type.String({ description: "Parvenu API key; falls back to PARVENU_API_KEY" })) }, { additionalProperties: false }),
    tools: (tool) => TOOLS.map((def) => tool({
        name: def.name,
        label: def.name,
        description: def.description,
        parameters: def.parameters,
        workspaceAccess: false,
        factory: ({ config }) => ({
            name: def.name,
            label: def.name,
            description: def.description,
            parameters: def.parameters,
            execute: async (_toolCallId, params, signal) => callParvenu(config.apiKey || process.env.PARVENU_API_KEY, def.endpoint, (params ?? {}), signal),
        }),
    })),
});
