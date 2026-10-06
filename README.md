# ThesisOS — Live Investment Thesis Intelligence

A working vertical slice for the SerpApi India Hackathon. Enter a sector, geography, investment stage, and optional question. The app runs live Google Search, Google News, Google Trends, Google Jobs, Google Scholar, and Google Patents queries through SerpApi and displays startup candidates, developments, possible risks, search momentum, hiring listings, research publications, patent results, a source trail, transparent research scoring, committee perspectives, focused company research, and a printable investment memo.

## Run locally

Requirements: Node.js 20.9+ and a [SerpApi key](https://serpapi.com/manage-api-key).

```bash
cd outputs/thesis-intelligence
npm install
cp .env.example .env.local
# Edit .env.local and set SERPAPI_API_KEY
npm run dev
```

Open <http://localhost:3000>. The form starts with **EV battery recycling / India / Seed–Series A**. Each thesis run makes eight SerpApi requests (two `engine=google`, two `engine=google_news`, and one each for `google_trends`, `google_jobs`, `google_scholar`, and `google_patents`). Opening a company candidate makes two additional focused requests. The optional **Run AI committee** action makes four role-specific `engine=google_ai_mode` requests informed by the current evidence, then a fifth chair request that reconciles completed perspectives. If fewer than two perspectives return, the chair is unavailable. Account for API quota. Without a key, the page loads and the research action gives a clear configuration error.

```bash
npm test
npm run lint
npm run build
```

## Evidence rules

- **Confirmed** means the cited search or news result explicitly reports the displayed headline. It does **not** mean the underlying event was independently verified.
- **Inferred** means a name, geography, funding mention, or risk was extracted or interpreted from a result preview. Risk cards separate the sourced headline from a conditional market effect and thesis implication; these consequences are not verified facts. Click the source before relying on them.
- **Unavailable** means no figure appeared in the cited preview. The app never fills missing private-company data with estimates.

This MVP uses SerpApi result previews; it does not scrape full articles or retrieve private databases. Company candidates can include false positives because names are conservatively inferred from search and news result titles. A candidate needs a company-specific topic mention, and funding, stage, and geography fields retain the exact result that supplied each preview claim. Search relevance varies by market, and a result's absence is not evidence that a company or risk does not exist.

The dashboard uses dated Google News items from approximately the last 18 months. Explicit funding stages outside the requested stage are excluded from the startup list; unknown stage remains labeled unavailable. IPO or public-listing headlines are also excluded from early-stage candidate lists. Similar reports of one event are grouped and their source links retained. This is heuristic grouping: it can still split one event or merge similar events.

Google Trends shows weekly, relative search interest on a 0–100 scale, excluding the incomplete week. Its 13-week averages indicate search activity, not market size or customer demand. Google Jobs shows up to five relevant listings and links to their posting pages. A listing does not establish startup traction or sustained hiring growth. Trends geography is supported for the country names in `lib/serpapi.ts` and two-letter country codes; unsupported locations produce a warning and no Trends chart.

Google Scholar returns recent, topic-matched publications using the user's geography as a search term. Google Patents returns topic-matched global patent results; it does not apply the user's geography as a filing-jurisdiction filter. Neither result set proves a startup owns technology, has an enforceable moat, or can operate without infringing others' rights. The rule-based evidence score remains based on startup, news, and risk evidence; these research results are shown separately.

The **evidence-readiness score** measures public research coverage across source diversity (20 points), company evidence (40), market activity (20), and risk visibility (20). It is not an investment score. The baseline Market, Bull, Bear, and Regulatory views are deterministic, evidence-linked summaries. The optional Google AI Mode committee runs four distinct research prompts using current-run leads, then a chair prompt reconciles the responses. AI Mode can return uncited or inaccurate claims; a source is linked beside a statement only when AI Mode associates that statement with the source. Uncited statements are visibly labeled, and all AI claims still require direct verification. No separate model API key is required.

The company drill-down prioritizes recent dated funding headlines over older search results, prefers company-activity descriptions over funding commentary, and shows separately sourced founder, investor, and partnership mentions when available. Investor names are shown only when a source ties them to the displayed funding amount. Customer traction and competitive advantage stay unavailable without direct evidence.

The **Investment memo** tab summarizes the current thesis run, preserves confirmed/inferred/unavailable labels, and cites used sources in a numbered register. **Download report** saves a standalone HTML copy; **Print / save PDF** opens the browser print flow where supported. Optional AI Mode committee output appears in the memo only when generated; uncited AI statements are labeled. The memo does not independently verify third-party claims.

## Architecture

- `app/page.tsx`: thesis form, dashboard, evidence library, candidate drawer.
- `app/api/analyze/route.ts`: input validation and server-only endpoint.
- `lib/serpapi.ts`: query plan, parallel SerpApi requests, country bias, timeout, partial failure handling.
- `lib/extract.ts`: source normalization, deduplication, cautious structured extraction.
- `lib/company-extract.ts`: company-specific field selection with dated funding and direct provenance.
- `lib/signals.ts`: Google Trends, Jobs, Scholar, and Patents result normalization.
- `lib/memo.ts` and `components/InvestmentMemo.tsx`: memo citation register and print-friendly report.
- `lib/committee.ts`: auditable score and rule-based committee perspectives.
- `lib/types.ts`: typed `SearchRun`, `Evidence`, candidate, development, and risk contracts.
- `app/api/company/route.ts`: focused company research endpoint and evidence-linked detail fields.
- `app/api/committee-ai/route.ts`, `lib/committee-prompts.ts`, and `lib/ai-mode.ts`: optional four-researcher AI Mode committee plus chair using the existing server-side SerpApi key.
- `lib/ai-mode-extract.ts`: text block and safe source-link extraction from AI Mode responses.

The `SearchRun` contract is the extension point for further research signals and public-company comparables. Add new evidence providers server-side and link every resulting claim to its source. No API key is prefixed with `NEXT_PUBLIC_`, sent to the browser, or stored in client state. `.env.local` is ignored by Git and should never be committed.

## Production notes

The endpoint has no user authentication or persistent cache. Add access control, rate limiting, and a cache before public deployment to protect API quota. Some SerpApi results can link to Google News redirect URLs; users should follow those links to the publisher and verify the full story.
