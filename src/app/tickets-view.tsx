"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
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
  initialTickets: ZendeskTicket[];
  initiallyCached: boolean;
  hasMore: boolean;
  afterCursor: string | null;
  beforeCursor: string | null;
  isFirstPage: boolean;
};

type Banner = { kind: "error" | "info"; text: string } | null;

function isUserCcd(ticket: ZendeskTicket, userId: number): boolean {
  return (
    ticket.collaborator_ids.includes(userId) ||
    ticket.email_cc_ids.includes(userId)
  );
}

export function TicketsView({
  userId,
  initialTickets,
  initiallyCached,
  hasMore,
  afterCursor,
  beforeCursor,
  isFirstPage,
}: Props) {
  const [tickets, setTickets] = useState(initialTickets);
  const [banner, setBanner] = useState<Banner>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function runToggle(ticket: ZendeskTicket, action: "remove" | "add") {
    setPendingId(ticket.id);
    setBanner(null);
    startTransition(async () => {
      const result =
        action === "remove"
          ? await removeFromCcAction({ ticketId: ticket.id })
          : await addToCcAction({ ticketId: ticket.id });

      if (result?.serverError) {
        setBanner({ kind: "error", text: result.serverError });
      } else if (result?.validationErrors) {
        setBanner({ kind: "error", text: "Invalid request." });
      } else if (result?.data?.ticket) {
        const updated = result.data.ticket;
        setTickets((prev) =>
          prev.map((t) => (t.id === ticket.id ? updated : t)),
        );
        setBanner({
          kind: "info",
          text:
            action === "remove"
              ? `Removed from CC on ticket #${ticket.id}.`
              : `Added back to CC on ticket #${ticket.id}.`,
        });
      }
      setPendingId(null);
    });
  }

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
          {initiallyCached ? " (page served from cache)" : ""}
        </p>
      </header>

      {banner ? (
        <div
          className={
            banner.kind === "error"
              ? "mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              : "mb-4 rounded-md border border-foreground/10 bg-muted px-3 py-2 text-sm"
          }
        >
          {banner.text}
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
            const rowPending = isPending && pendingId === ticket.id;
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
                        disabled={rowPending}
                        onClick={() => runToggle(ticket, "remove")}
                      >
                        {rowPending ? "Removing…" : "Remove from CC"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={rowPending}
                        onClick={() => runToggle(ticket, "add")}
                      >
                        {rowPending ? "Adding…" : "Add back to CC"}
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
