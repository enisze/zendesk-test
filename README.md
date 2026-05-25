# Zendesk CC Tickets

A small demo app that lists Zendesk tickets where a predefined user is CC'd and
lets you remove that user from CC (or add them back). The frontend is React
(Next.js App Router) and the backend is Node, served by the same Next.js
process via Route Handlers under `/api`.

Zendesk credentials never reach the browser: every Zendesk call is made
server-side and the page only talks to the local `/api` endpoints.

## Features

- `GET /api/tickets` — lists tickets where the demo user is CC'd.
- `DELETE /api/tickets/:id/cc` — removes the demo user from CC on a ticket.
- `POST /api/tickets/:id/cc` — adds the demo user back to CC.
- **SQLite cache** (`data/cache.sqlite`) keeps the ticket list for 2 minutes
  so the UI doesn't hammer Zendesk on every refresh. The cache is invalidated
  whenever a CC change succeeds.
- **Rate limiting** on remove-from-CC:
  - 1 request per user per minute
  - 3 requests globally per minute
  Limits return HTTP 429 with a `Retry-After` header.

## Setup

Requires [Bun](https://bun.sh/) (the repo uses bun as its package manager).

```bash
bun install
cp .env.example .env.local
# edit .env.local with real Zendesk values
bun run dev
```

Then open <http://localhost:3000>.

### Environment variables

| Variable             | Description                                                                |
| -------------------- | -------------------------------------------------------------------------- |
| `ZENDESK_SUBDOMAIN`  | The `acme` in `https://acme.zendesk.com`.                                  |
| `ZENDESK_EMAIL`      | Email of the Zendesk user the API token belongs to.                        |
| `ZENDESK_API_TOKEN`  | Zendesk API token (Admin Center → Apps and integrations → APIs).           |
| `DEMO_USER_ID`       | Numeric ID of the user whose CC'd tickets are shown. Hard-coded for demo.  |

## How it works

- `src/app/page.tsx` renders the (client) `TicketsView` component, which fetches
  `/api/tickets` and renders each row with a `Remove from CC` button. After a
  successful remove, the row swaps to an `Add back to CC` button.
- `src/server/zendesk.ts` is the Zendesk client. The CC list comes from the
  Search API (`type:ticket cc:<user_id>`); removes/adds are done by `PUT
  /tickets/:id.json` with an updated `collaborator_ids` array, which is the
  documented way to drop or grant CC access. Other CC'd users are preserved.
- `src/server/cache.ts` is a tiny key-value cache backed by `better-sqlite3`
  with a per-entry TTL.
- `src/server/rate-limit.ts` keeps a sliding 60-second window of timestamps
  per key in memory. The two limits (per-user, global) are checked together;
  if global fails the per-user hit is rolled back so users aren't penalised
  for someone else's traffic.

## API examples

```bash
# list tickets CC'ing the demo user
curl http://localhost:3000/api/tickets

# remove demo user from CC on ticket 42
curl -X DELETE http://localhost:3000/api/tickets/42/cc

# add demo user back to CC
curl -X POST http://localhost:3000/api/tickets/42/cc
```

## Limitations

- The rate limiter is in-process; for multi-instance deploys swap it for
  Redis or another shared store.
- Cache and rate-limit state are stored on the server only, never shipped to
  the browser.
- The Zendesk Search API is eventually consistent; expect a short lag between
  a CC change and that ticket disappearing from the list (the local cache is
  invalidated on writes, but Zendesk's own search index may take a few
  seconds to update).
