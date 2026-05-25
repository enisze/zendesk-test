"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/server/config";
import { checkRemoveCcRateLimit } from "@/server/rate-limit";
import {
  ZendeskError,
  type ZendeskTicket,
  zendeskRepository,
} from "@/repositories/zendesk-repository";

export type ActionResult =
  | { ok: true; ticket: ZendeskTicket }
  | { ok: false; error: string; retryAfterSeconds?: number };

export async function removeFromCcAction(
  ticketId: number,
): Promise<ActionResult> {
  const userId = config.demoUserId;

  const limit = checkRemoveCcRateLimit(userId);
  if (!limit.ok) {
    return {
      ok: false,
      error:
        limit.scope === "user"
          ? `Rate limit: 1 remove-from-CC per user per minute. Try again in ${limit.retryAfter}s.`
          : `Rate limit: 3 remove-from-CC globally per minute. Try again in ${limit.retryAfter}s.`,
      retryAfterSeconds: limit.retryAfter,
    };
  }

  try {
    const ticket = await zendeskRepository.removeUserFromCc(ticketId, userId);
    revalidatePath("/");
    return { ok: true, ticket };
  } catch (err) {
    return { ok: false, error: formatError(err) };
  }
}

export async function addToCcAction(
  ticketId: number,
): Promise<ActionResult> {
  try {
    const ticket = await zendeskRepository.addUserToCc(
      ticketId,
      config.demoUserId,
    );
    revalidatePath("/");
    return { ok: true, ticket };
  } catch (err) {
    return { ok: false, error: formatError(err) };
  }
}

function formatError(err: unknown): string {
  if (err instanceof ZendeskError) return `Zendesk error: ${err.message}`;
  return err instanceof Error ? err.message : "Unknown error";
}
