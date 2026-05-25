"use client";

import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
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

type Props = {
  userId: number;
  tickets: ZendeskTicket[];
  cached: boolean;
  hasMore: boolean;
  afterCursor: string | null;
  beforeCursor: string | null;
  isFirstPage: boolean;
};

function isUserCcd(ticket: ZendeskTicket, userId: number): boolean {
  return (
    ticket.collaborator_ids.includes(userId) ||
    ticket.email_cc_ids.includes(userId)
  );
}

export function TicketsView({
  userId,
  tickets,
  cached,
  hasMore,
  afterCursor,
  beforeCursor,
  isFirstPage,
}: Props) {
  const remove = useAction(removeFromCcAction);
  const add = useAction(addToCcAction);

  const serverError =
    remove.result?.serverError ?? add.result?.serverError ?? null;

  const showPagination =
    !isFirstPage || hasMore || beforeCursor !== null || afterCursor !== null;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Zendesk tickets CC'ing you
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Showing tickets where user #{userId} is CC'd.
          {cached ? " (page served from cache)" : ""}
        </p>
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

      {showPagination ? (
        <nav className="mt-6 flex items-center justify-between gap-2">
          {beforeCursor && !isFirstPage ? (
            <Link
              href={`/?before=${encodeURIComponent(beforeCursor)}`}
              className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              ← Previous
            </Link>
          ) : (
            <Link
              href="/"
              className={
                isFirstPage
                  ? "pointer-events-none inline-flex h-7 items-center rounded-md border border-border bg-background px-2.5 text-[0.8rem] font-medium opacity-50"
                  : "inline-flex h-7 items-center rounded-md border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
              }
              aria-disabled={isFirstPage}
            >
              ← First
            </Link>
          )}

          {hasMore && afterCursor ? (
            <Link
              href={`/?after=${encodeURIComponent(afterCursor)}`}
              className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              Next →
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">End of list</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
