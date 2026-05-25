import "server-only";
import { cacheGet, cacheInvalidate, cacheSet } from "@/server/cache";
import { config } from "@/server/config";

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

export type ListResult = {
  tickets: ZendeskTicket[];
  cached: boolean;
};

export class ZendeskError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type ApiTicket = Omit<
  ZendeskTicket,
  "collaborator_ids" | "email_cc_ids"
> & {
  collaborator_ids?: number[];
  email_cc_ids?: number[];
};

function normalize(t: ApiTicket): ZendeskTicket {
  return {
    ...t,
    collaborator_ids: t.collaborator_ids ?? [],
    email_cc_ids: t.email_cc_ids ?? [],
  };
}

function ccCacheKey(userId: number): string {
  return `cc-tickets:${userId}`;
}

async function zendeskFetch(
  pathname: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(`${config.zendesk.baseUrl}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.zendesk.apiToken}`,
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

export const zendeskRepository = {
  async listCcTickets(userId: number): Promise<ListResult> {
    const key = ccCacheKey(userId);
    const cached = await cacheGet<ZendeskTicket[]>(key);
    if (cached) return { tickets: cached, cached: true };

    const query = encodeURIComponent(`type:ticket cc:${userId}`);
    const res = await zendeskFetch(`/search.json?query=${query}`);
    const data = (await res.json()) as { results: ApiTicket[] };
    const tickets = data.results.filter((r) => "subject" in r).map(normalize);

    await cacheSet(key, tickets, config.cacheTtlMs);
    return { tickets, cached: false };
  },

  async getTicket(ticketId: number): Promise<ZendeskTicket> {
    const res = await zendeskFetch(`/tickets/${ticketId}.json`);
    const data = (await res.json()) as { ticket: ApiTicket };
    return normalize(data.ticket);
  },

  async setCollaborators(
    ticketId: number,
    collaboratorIds: number[],
  ): Promise<ZendeskTicket> {
    const res = await zendeskFetch(`/tickets/${ticketId}.json`, {
      method: "PUT",
      body: JSON.stringify({ ticket: { collaborator_ids: collaboratorIds } }),
    });
    const data = (await res.json()) as { ticket: ApiTicket };
    return normalize(data.ticket);
  },

  async removeUserFromCc(
    ticketId: number,
    userId: number,
  ): Promise<ZendeskTicket> {
    const ticket = await this.getTicket(ticketId);
    const current = new Set([
      ...ticket.collaborator_ids,
      ...ticket.email_cc_ids,
    ]);
    if (!current.has(userId)) return ticket;
    current.delete(userId);
    const updated = await this.setCollaborators(ticketId, Array.from(current));
    await cacheInvalidate(ccCacheKey(userId));
    return updated;
  },

  async addUserToCc(
    ticketId: number,
    userId: number,
  ): Promise<ZendeskTicket> {
    const ticket = await this.getTicket(ticketId);
    const current = new Set([
      ...ticket.collaborator_ids,
      ...ticket.email_cc_ids,
    ]);
    current.add(userId);
    const updated = await this.setCollaborators(ticketId, Array.from(current));
    await cacheInvalidate(ccCacheKey(userId));
    return updated;
  },
};
