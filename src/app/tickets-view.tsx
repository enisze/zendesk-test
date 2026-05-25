"use client";

import { useAction } from "next-safe-action/hooks";
import { useQueryStates } from "nuqs";
import { PaginationLink } from "@/components/pagination-link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ZendeskTicket } from "@/repositories/zendesk-repository";
import { addToCcAction, removeFromCcAction } from "./actions";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  paginationParsers,
} from "./search-params";

type Props = {
  userId: number;
  tickets: ZendeskTicket[];
  cached: boolean;
  hasMore: boolean;
  afterCursor: string | null;
  beforeCursor: string | null;
  isFirstPage: boolean;
  size: number;
};

function isUserCcd(ticket: ZendeskTicket, userId: number): boolean {
  return (
    ticket.collaborator_ids.includes(userId) ||
    ticket.email_cc_ids.includes(userId)
  );
}

function buildHref(params: {
  size: number;
  after?: string | null;
  before?: string | null;
}): string {
  const sp = new URLSearchParams();
  if (params.size !== DEFAULT_PAGE_SIZE) sp.set("size", String(params.size));
  if (params.after) sp.set("after", params.after);
  if (params.before) sp.set("before", params.before);
  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

export function TicketsView({
  userId,
  tickets,
  cached,
  hasMore,
  afterCursor,
  beforeCursor,
  isFirstPage,
  size,
}: Props) {
  const remove = useAction(removeFromCcAction);
  const add = useAction(addToCcAction);

  // The select changes size and clears cursors in a single navigation.
  const [, setParams] = useQueryStates(paginationParsers, { shallow: false });

  const serverError =
    remove.result?.serverError ?? add.result?.serverError ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Zendesk tickets CC'ing you
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Showing tickets where user #{userId} is CC'd.
            {cached ? " (page served from cache)" : ""}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Per page
          <select
            value={size}
            onChange={(e) =>
              setParams({
                size: Number(e.target.value),
                after: null,
                before: null,
              })
            }
            className="h-7 rounded-md border border-border bg-background px-2 text-[0.8rem] font-medium text-foreground"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </header>

      {serverError ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      ) : null}

      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tickets on this page.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tickets.map((ticket) => {
            const ccd = isUserCcd(ticket, userId);
            const isRemoving =
              remove.isPending && remove.input?.ticketId === ticket.id;
            const isAdding =
              add.isPending && add.input?.ticketId === ticket.id;
            return (
              <li key={ticket.id}>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      #{ticket.id} — {ticket.subject || "(no subject)"}
                    </CardTitle>
                    <CardDescription>
                      Status: {ticket.status}
                      {ticket.priority ? ` · Priority: ${ticket.priority}` : ""}
                      {" · "}
                      Updated {new Date(ticket.updated_at).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {ccd ? "You're on CC." : "You're no longer on CC."}
                    </span>
                    {ccd ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isRemoving}
                        onClick={() => remove.execute({ ticketId: ticket.id })}
                      >
                        {isRemoving ? "Removing…" : "Remove from CC"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isAdding}
                        onClick={() => add.execute({ ticketId: ticket.id })}
                      >
                        {isAdding ? "Adding…" : "Add back to CC"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <nav className="mt-6 flex items-center justify-between gap-2">
        <PaginationLink
          href={
            beforeCursor && !isFirstPage
              ? buildHref({ size, before: beforeCursor })
              : undefined
          }
          disabled={isFirstPage || !beforeCursor}
          ariaLabel="Previous page"
        >
          ← Previous
        </PaginationLink>

        <PaginationLink
          href={hasMore && afterCursor ? buildHref({ size, after: afterCursor }) : undefined}
          disabled={!hasMore || !afterCursor}
          ariaLabel="Next page"
        >
          Next →
        </PaginationLink>
      </nav>
    </div>
  );
}
