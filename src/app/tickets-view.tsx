"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Ticket = {
  id: number;
  subject: string;
  status: string;
  priority: string | null;
  url: string;
  created_at: string;
  updated_at: string;
  collaborator_ids: number[];
  email_cc_ids: number[];
};

type ListResponse = {
  userId: number;
  cached: boolean;
  tickets: Ticket[];
};

type Banner = { kind: "error" | "info"; text: string } | null;

function isUserCcd(ticket: Ticket, userId: number): boolean {
  return (
    ticket.collaborator_ids.includes(userId) ||
    ticket.email_cc_ids.includes(userId)
  );
}

export function TicketsView() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [banner, setBanner] = useState<Banner>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/tickets", { cache: "no-store" });
      const data = (await res.json()) as ListResponse | { message?: string };
      if (!res.ok) {
        const msg =
          "message" in data && data.message ? data.message : "Failed to load.";
        setBanner({ kind: "error", text: msg });
        return;
      }
      const ok = data as ListResponse;
      setTickets(ok.tickets);
      setUserId(ok.userId);
      setCached(ok.cached);
    } catch (err) {
      setBanner({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to load.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleCc = useCallback(
    async (ticket: Ticket, action: "remove" | "add") => {
      setPendingId(ticket.id);
      setBanner(null);
      try {
        const res = await fetch(`/api/tickets/${ticket.id}/cc`, {
          method: action === "remove" ? "DELETE" : "POST",
        });
        const data = (await res.json()) as {
          ticket?: Ticket;
          message?: string;
          retryAfterSeconds?: number;
          scope?: string;
        };
        if (res.status === 429) {
          setBanner({
            kind: "error",
            text:
              `${data.message ?? "Rate limited."}` +
              (data.retryAfterSeconds
                ? ` Try again in ${data.retryAfterSeconds}s.`
                : ""),
          });
          return;
        }
        if (!res.ok || !data.ticket) {
          setBanner({
            kind: "error",
            text: data.message ?? "Request failed.",
          });
          return;
        }
        setTickets((prev) =>
          prev.map((t) => (t.id === ticket.id ? (data.ticket as Ticket) : t)),
        );
        setBanner({
          kind: "info",
          text:
            action === "remove"
              ? `Removed from CC on ticket #${ticket.id}.`
              : `Added back to CC on ticket #${ticket.id}.`,
        });
      } catch (err) {
        setBanner({
          kind: "error",
          text: err instanceof Error ? err.message : "Request failed.",
        });
      } finally {
        setPendingId(null);
      }
    },
    [],
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Zendesk tickets CC'ing you
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {userId !== null
              ? `Showing tickets where user #${userId} is CC'd.`
              : "Loading…"}
            {cached ? " (served from cache)" : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </Button>
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

      {loading && tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading tickets…</p>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tickets currently CC this user.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tickets.map((ticket) => {
            const ccd = userId !== null && isUserCcd(ticket, userId);
            const isPending = pendingId === ticket.id;
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
                      Updated{" "}
                      {new Date(ticket.updated_at).toLocaleString()}
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
                        disabled={isPending}
                        onClick={() => void toggleCc(ticket, "remove")}
                      >
                        {isPending ? "Removing…" : "Remove from CC"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => void toggleCc(ticket, "add")}
                      >
                        {isPending ? "Adding…" : "Add back to CC"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
