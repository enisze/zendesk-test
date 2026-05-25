# Zendesk CC Tickets

A small demo app that lists Zendesk tickets where a predefined user is CC'd
and lets you remove that user from CC (or add them back). The frontend is
React (Next.js App Router) and the backend is Node, running in the same
Next.js process.

Zendesk credentials never reach the browser:

- The home page is a **server component** that calls the Zendesk repository
  directly during render.
- Mutations are exposed as **type-safe server actions** built with
  [`next-safe-action`](https://next-safe-action.dev/) — zod-validated input,
  typed `result.data` / `result.serverError` on the client, never the API
  token.

## Architecture

```
src/
├─ app/
│  ├─ page.tsx           # server component: fetches via repository, renders TicketsView
│  ├─ tickets-view.tsx   # client component: buttons call safe actions
│  └─ actions.ts         # "use server" — removeFromCcAction, addToCcAction
├─ lib/
│  └─ safe-action.ts     # createSafeActionClient with custom error handler
├─ repositories/
│  └─ zendesk-repository.ts   # all Zendesk HTTP, transparently cached
└─ server/
   ├─ config.ts         # env validation
   ├─ cache.ts          # Keyv + @keyv/sqlite (TTL key/value)
   └─ rate-limit.ts     # rate-limiter-flexible (in-memory)
```

## Features

- **Repository pattern**: `zendeskRepository.listCcTickets / updateEmailCc`.
  The repo is the only place that talks to Zendesk and the only place that
  touches the cache.
- **SQLite cache via [Keyv](https://keyv.org/)**: each cursor page is
  cached separately for 2 minutes in `data/cache.sqlite`
  (`cc-tickets:<userId>:<cursor>`). After a CC change we iterate the
  namespace and invalidate every page for the affected user via a prefix
  delete. SQLite is used **only** for this cache — there are no domain
  tables and no ORM in the project.
- **Type-safe server actions** via `next-safe-action`: input schemas (zod)
  are validated on the server; typed errors (`RateLimitError`, `ZendeskError`)
  are mapped to friendly messages by `handleServerError` and surfaced as
  `result.serverError` on the client.
- **Rate limiting** on remove-from-CC:
  - 1 request per user per minute
  - 3 requests globally per minute
  A `RateLimitError` is thrown inside the action and rendered with a
  "try again in Ns" hint.

## Setup

Requires [Bun](https://bun.sh/).

```bash
bun install
cp .env.example .env.local
# edit .env.local with real Zendesk values
bun run dev
```

Then open <http://localhost:3000>.

### Environment variables

| Variable             | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| `ZENDESK_BASE_URL`   | Full API base URL, e.g. `https://con-leafworks2.zendesk.com/api/v2`. |
| `ZENDESK_API_TOKEN`  | Token sent as `Authorization: Bearer <token>`.                       |
| `DEMO_USER_ID`       | Numeric ID of the user whose CC'd tickets are shown.                 |

## How it works

- The CC list comes from Zendesk's purpose-built
  `GET /users/:id/tickets/ccd.json` endpoint with cursor pagination
  (`page[size]` / `page[after]` / `page[before]`). Previous + Next links are
  rendered as plain navigations (`/?after=...` or `/?before=...`), so each
  page is server-rendered and independently cacheable. We avoid the
  Search API because it's eventually consistent and harder to scope.
- Removing/adding CC is done by a single `PUT /tickets/:id.json` with
  `{ ticket: { email_ccs: [{ user_id, action: 'put' | 'delete' }] } }` —
  Zendesk's delta-update API. No read-modify-write is needed: the delta
  only touches the demo user and every other CC'd user is preserved.
- The cache layer is [Keyv](https://keyv.org/) backed by `@keyv/sqlite`,
  with TTLs baked into each `set(key, value, ttlMs)` call. Prefix
  invalidation walks the namespace iterator and deletes matching keys —
  acceptable here because the cache stays small (a handful of cursor
  pages per user).
- Rate limiting is provided by
  [`rate-limiter-flexible`](https://github.com/animir/node-rate-limiter-flexible)
  via two `RateLimiterMemory` instances (per-user and global, both
  60-second windows). The two limits are consumed in order; if the global
  gate fails, the per-user point is rewarded back so a user isn't
  penalised for someone else's traffic.

## Limitations

- The rate limiter is in-process; for multi-instance deploys swap it for
  Redis or another shared store (`rate-limiter-flexible` supports it
  with the same `consume`/`reward` API).
- Cache invalidation iterates the Keyv namespace; fine at this scale,
  not great if the cache grows to thousands of keys per user.
