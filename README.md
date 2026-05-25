# Zendesk CC Tickets

A small demo app that lists Zendesk tickets where a predefined user is CC'd
and lets you remove that user from CC (or add them back). The frontend is
React (Next.js App Router) and the backend is Node, running in the same
Next.js process.

Zendesk credentials never reach the browser:

- The home page is a **server component** that calls the Zendesk repository
  directly during render.
- Mutations are exposed as **server actions** (`removeFromCcAction`,
  `addToCcAction`), so the client only sends a typed RPC — never the API
  token.

## Architecture

```
src/
├─ app/
│  ├─ page.tsx           # server component: fetches via repository, renders TicketsView
│  ├─ tickets-view.tsx   # client component: buttons call server actions
│  └─ actions.ts         # "use server" — removeFromCcAction, addToCcAction
├─ repositories/
│  └─ zendesk-repository.ts   # all Zendesk HTTP, transparently cached
└─ server/
   ├─ config.ts         # env validation
   ├─ cache.ts          # Drizzle-backed key/value cache w/ TTL
   ├─ rate-limit.ts     # sliding-window limiter
   └─ db/
      ├─ index.ts       # better-sqlite3 + drizzle init
      └─ schema.ts      # cache_entries table
```

## Features

- **Repository pattern**: `zendeskRepository.listCcTickets / removeUserFromCc /
  addUserToCc`. The repo is the only place that talks to Zendesk and the only
  place that touches the cache.
- **SQLite cache via Drizzle ORM**: tickets cached for 2 minutes in
  `data/cache.sqlite`. Cache is invalidated automatically when a CC change
  succeeds.
- **Rate limiting** on remove-from-CC:
  - 1 request per user per minute
  - 3 requests globally per minute
  Returns a friendly error to the UI with a "try again in Ns" hint.

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

- The CC list comes from the Zendesk Search API
  (`type:ticket cc:<user_id>`).
- Removing/adding CC is done by `PUT /tickets/:id.json` with an updated
  `collaborator_ids` array. The repo reads the current ticket first so it
  only removes (or adds) the demo user — every other CC'd user is preserved.
- The cache layer uses Drizzle against a single `cache_entries` table
  (`key`, `value`, `expires_at`). The schema is created on boot, so there's
  no migration step.
- The rate limiter keeps a sliding 60-second window of timestamps per key
  in memory. The two limits are checked together; if the global gate fails
  the per-user hit is rolled back so a user isn't penalised for someone
  else's traffic.

## Limitations

- The rate limiter is in-process; for multi-instance deploys swap it for
  Redis or another shared store.
- The Zendesk Search API is eventually consistent, so a freshly removed
  ticket may stay visible for a few seconds after the local cache expires.
