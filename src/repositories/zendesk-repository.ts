import "server-only";
import {
  cacheGet,
  cacheInvalidatePrefix,
  cacheSet,
} from "@/server/cache";
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

export type Cursor = string | null;

export type ListCcTicketsArgs = {
  userId: number;
  pageSize?: number;
  after?: Cursor;
  before?: Cursor;
};

export type ListResult = {
  tickets: ZendeskTicket[];
  cached: boolean;
  hasMore: boolean;
  afterCursor: Cursor;
  beforeCursor: Cursor;
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

type ListResponse = {
  tickets: ApiTicket[];
  meta?: {
    has_more?: boolean;
    after_cursor?: string | null;
    before_cursor?: string | null;
  };
};

function normalize(t: ApiTicket): ZendeskTicket {
  return {
    ...t,
    collaborator_ids: t.collaborator_ids ?? [],
    email_cc_ids: t.email_cc_ids ?? [],
  };
}

function ccCachePrefix(userId: number): string {
  return `cc-tickets:${userId}:`;
}

function ccCacheKey({ userId, pageSize, after, before }: ListCcTicketsArgs) {
  return `${ccCachePrefix(userId)}${pageSize ?? ""}|${after ?? ""}|${before ?? ""}`;
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

function buildCcdUrl(args: ListCcTicketsArgs): string {
  const params = new URLSearchParams();
  params.set("page[size]", String(args.pageSize ?? 25));
  if (args.after) params.set("page[after]", args.after);
  if (args.before) params.set("page[before]", args.before);
  return `/users/${args.userId}/tickets/ccd.json?${params.toString()}`;
}

export const zendeskRepository = {
  async listCcTickets(args: ListCcTicketsArgs): Promise<ListResult> {
    const key = ccCacheKey(args);
    const cached = await cacheGet<Omit<ListResult, "cached">>(key);
    if (cached) return { ...cached, cached: true };

    const res = await zendeskFetch(buildCcdUrl(args));
    const data = (await res.json()) as ListResponse;

    const result: Omit<ListResult, "cached"> = {
      tickets: data.tickets.map(normalize),
      hasMore: data.meta?.has_more ?? false,
      afterCursor: data.meta?.after_cursor ?? null,
      beforeCursor: data.meta?.before_cursor ?? null,
    };

    await cacheSet(key, result, config.cacheTtlMs);
    return { ...result, cached: false };
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
    await cacheInvalidatePrefix(ccCachePrefix(userId));
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
    await cacheInvalidatePrefix(ccCachePrefix(userId));
    return updated;
  },
};
