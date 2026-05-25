import "server-only";
import { z } from "zod";
import {
  cacheGet,
  cacheInvalidatePrefix,
  cacheSet,
} from "@/server/cache";
import { config } from "@/server/config";

const ticketSchema = z.object({
  id: z.number(),
  subject: z.string().nullable().transform((v) => v ?? ""),
  status: z.string(),
  priority: z.string().nullable().optional().transform((v) => v ?? null),
  url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  collaborator_ids: z.array(z.number()).optional().default([]),
  email_cc_ids: z.array(z.number()).optional().default([]),
});

const metaSchema = z.object({
  has_more: z.boolean().default(false),
  after_cursor: z.string().nullable().default(null),
  before_cursor: z.string().nullable().default(null),
});

const ccdListResponseSchema = z.object({
  tickets: z.array(ticketSchema),
  meta: metaSchema.default({
    has_more: false,
    after_cursor: null,
    before_cursor: null,
  }),
});

const singleTicketResponseSchema = z.object({
  ticket: ticketSchema,
});

export type ZendeskTicket = z.infer<typeof ticketSchema>;

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

function ccCachePrefix(userId: number): string {
  return `cc-tickets:${userId}:`;
}

function ccCacheKey({ userId, pageSize, after, before }: ListCcTicketsArgs) {
  return `${ccCachePrefix(userId)}${pageSize ?? ""}|${after ?? ""}|${before ?? ""}`;
}

async function zendeskFetch<T extends z.ZodTypeAny>(
  pathname: string,
  schema: T,
  init?: RequestInit,
): Promise<z.infer<T>> {
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

  const json: unknown = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ZendeskError(
      `Zendesk ${init?.method ?? "GET"} ${pathname} returned an unexpected payload: ${parsed.error.message}`,
      500,
    );
  }
  return parsed.data;
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

    const data = await zendeskFetch(buildCcdUrl(args), ccdListResponseSchema);

    const result: Omit<ListResult, "cached"> = {
      tickets: data.tickets,
      hasMore: data.meta.has_more,
      afterCursor: data.meta.after_cursor,
      beforeCursor: data.meta.before_cursor,
    };

    await cacheSet(key, result, config.cacheTtlMs);
    return { ...result, cached: false };
  },

  async getTicket(ticketId: number): Promise<ZendeskTicket> {
    const data = await zendeskFetch(
      `/tickets/${ticketId}.json`,
      singleTicketResponseSchema,
    );
    return data.ticket;
  },

  async setCollaborators(
    ticketId: number,
    collaboratorIds: number[],
  ): Promise<ZendeskTicket> {
    const data = await zendeskFetch(
      `/tickets/${ticketId}.json`,
      singleTicketResponseSchema,
      {
        method: "PUT",
        body: JSON.stringify({ ticket: { collaborator_ids: collaboratorIds } }),
      },
    );
    return data.ticket;
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
