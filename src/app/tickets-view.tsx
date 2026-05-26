"use client";

import { useAction } from "next-safe-action/hooks";
import { useQueryStates } from "nuqs";
import { useState } from "react";
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
  PAGE_SIZE_OPTIONS,
  paginationParsers,
  serializePagination,
} from "./search-params";

type Props = {
  userId: number;
  tickets: ZendeskTicket[];
  cached: boolean;
  hasMore: boolean;
  afterCursor: string | null;
  beforeCursor: string | null;
  page: number;
  size: number;
};

export function TicketsView({
  userId,
  tickets,
  cached,
  hasMore,
  afterCursor,
  beforeCursor,
  page,
  size,
}: Props) {
  const isFirstPage = page <= 1;
  const remove = useAction(removeFromCcAction);
  const add = useAction(addToCcAction);
  const [addTicketId, setAddTicketId] = useState("");
  const [submittedAddId, setSubmittedAddId] = useState<number | null>(null);

  const [, setParams] = useQueryStates(paginationParsers, { shallow: false });

  const serverError =
    remove.result?.serverError ?? add.result?.serverError ?? null;

  function handleAddById(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ticketId = Number(addTicketId);
    if (!Number.isInteger(ticketId) || ticketId <= 0) return;
    setSubmittedAddId(ticketId);
    add.execute({ ticketId });
    setAddTicketId("");
  }

  const isAddingFromForm =
    submittedAddId !== null &&
    add.isPending &&
    add.input?.ticketId === submittedAddId;

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
                page: null,
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

      <form
        onSubmit={handleAddById}
        className="mb-4 flex items-end gap-2 rounded-md border border-border bg-background px-3 py-2"
      >
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Add yourself to a ticket by ID
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={addTicketId}
            onChange={(e) => setAddTicketId(e.target.value)}
            placeholder="e.g. 12345"
            className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          />
        </label>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={add.isPending || addTicketId.trim() === ""}
        >
          {isAddingFromForm ? "Adding…" : "Add to CC"}
        </Button>
      </form>

      {serverError && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      )}

      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tickets on this page.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tickets.map((ticket) => {
            const isRemoving =
              remove.isPending && remove.input?.ticketId === ticket.id;
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
                      Updated {new Date(ticket.updated_at).toLocaleString("en-US")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-end gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isRemoving}
                      onClick={() => remove.execute({ ticketId: ticket.id })}
                    >
                      {isRemoving ? "Removing…" : "Remove from CC"}
                    </Button>
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
            isFirstPage
              ? undefined
              : page === 2
                ? serializePagination("/", {
                    size,
                    after: null,
                    before: null,
                    page: null,
                  })
                : beforeCursor
                  ? serializePagination("/", {
                      size,
                      before: beforeCursor,
                      after: null,
                      page: page - 1,
                    })
                  : undefined
          }
          disabled={isFirstPage || (page > 2 && !beforeCursor)}
          ariaLabel="Previous page"
        >
          ← Previous
        </PaginationLink>

        <span className="text-xs text-muted-foreground">Page {page}</span>

        <PaginationLink
          href={
            hasMore && afterCursor
              ? serializePagination("/", {
                  size,
                  after: afterCursor,
                  before: null,
                  page: page + 1,
                })
              : undefined
          }
          disabled={!hasMore || !afterCursor}
          ariaLabel="Next page"
        >
          Next →
        </PaginationLink>
      </nav>
    </div>
  );
}
