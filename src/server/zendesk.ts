import "server-only";
import { config, zendeskAuthHeader, zendeskBaseUrl } from "./config";
import { cacheGet, cacheInvalidate, cacheSet } from "./cache";

export type ZendeskTicket = {
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

type ZendeskApiTicket = {
  id: number;
  subject: string;
  status: string;
  priority: string | null;
  url: string;
  created_at: string;
  updated_at: string;
  collaborator_ids?: number[];
  email_cc_ids?: number[];
};

type SearchResponse = {
  results: ZendeskApiTicket[];
};

type TicketResponse = {
  ticket: ZendeskApiTicket;
};

async function zendeskFetch(
  pathname: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(`${zendeskBaseUrl()}${pathname}`, {
    ...init,
    headers: {
      Authorization: zendeskAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ZendeskError(
      `Zendesk ${init?.method ?? "GET"} ${pathname} failed: ${res.status} ${body}`,
      res.status,
    );
  }
  return res;
}

export class ZendeskError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function normalize(t: ZendeskApiTicket): ZendeskTicket {
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    url: t.url,
    created_at: t.created_at,
    updated_at: t.updated_at,
    collaborator_ids: t.collaborator_ids ?? [],
    email_cc_ids: t.email_cc_ids ?? [],
  };
}

function cacheKey(userId: number): string {
  return `cc-tickets:${userId}`;
}

export async function listCcTickets(
  userId: number,
): Promise<{ tickets: ZendeskTicket[]; cached: boolean }> {
  const key = cacheKey(userId);
  const cached = cacheGet<ZendeskTicket[]>(key);
  if (cached) return { tickets: cached, cached: true };

  const query = encodeURIComponent(`type:ticket cc:${userId}`);
  const res = await zendeskFetch(`/search.json?query=${query}`);
  const data = (await res.json()) as SearchResponse;
  const tickets = data.results.filter((r) => "subject" in r).map(normalize);

  cacheSet(key, tickets, config.cacheTtlMs);
  return { tickets, cached: false };
}

async function getTicket(ticketId: number): Promise<ZendeskTicket> {
  const res = await zendeskFetch(`/tickets/${ticketId}.json`);
  const data = (await res.json()) as TicketResponse;
  return normalize(data.ticket);
}

async function updateCollaborators(
  ticketId: number,
  collaboratorIds: number[],
): Promise<ZendeskTicket> {
  const res = await zendeskFetch(`/tickets/${ticketId}.json`, {
    method: "PUT",
    body: JSON.stringify({
      ticket: { collaborator_ids: collaboratorIds },
    }),
  });
  const data = (await res.json()) as TicketResponse;
  return normalize(data.ticket);
}

export async function removeUserFromCc(
  ticketId: number,
  userId: number,
): Promise<ZendeskTicket> {
  const ticket = await getTicket(ticketId);
  const current = new Set([
    ...ticket.collaborator_ids,
    ...ticket.email_cc_ids,
  ]);
  if (!current.has(userId)) return ticket;
  current.delete(userId);
  const updated = await updateCollaborators(ticketId, Array.from(current));
  cacheInvalidate(cacheKey(userId));
  return updated;
}

export async function addUserToCc(
  ticketId: number,
  userId: number,
): Promise<ZendeskTicket> {
  const ticket = await getTicket(ticketId);
  const current = new Set([
    ...ticket.collaborator_ids,
    ...ticket.email_cc_ids,
  ]);
  current.add(userId);
  const updated = await updateCollaborators(ticketId, Array.from(current));
  cacheInvalidate(cacheKey(userId));
  return updated;
}
