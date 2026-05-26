"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zendeskRepository } from "@/repositories/zendesk-repository";
import { RateLimitError, actionClient } from "@/lib/safe-action";
import { config } from "@/server/config";
import { checkRemoveCcRateLimit } from "@/server/rate-limit";

const ticketIdSchema = z.object({
  ticketId: z.number().int().positive(),
});

export const removeFromCcAction = actionClient
  .inputSchema(ticketIdSchema)
  .action(async ({ parsedInput }) => {
    const userId = config.demoUserId;

    const limit = await checkRemoveCcRateLimit(userId);
    if (!limit.ok) {
      throw new RateLimitError(
        limit.scope === "user"
          ? "Rate limit: 1 remove-from-CC per user per minute."
          : "Rate limit: 3 remove-from-CC globally per minute.",
        limit.retryAfter,
        limit.scope,
      );
    }

    const ticket = await zendeskRepository.updateEmailCc({
      ticketId: parsedInput.ticketId,
      userId,
      action: "delete",
    });
    revalidatePath("/");
    return { ticket };
  });

export const addToCcAction = actionClient
  .inputSchema(ticketIdSchema)
  .action(async ({ parsedInput }) => {
    const ticket = await zendeskRepository.updateEmailCc({
      ticketId: parsedInput.ticketId,
      userId: config.demoUserId,
      action: "put",
    });
    revalidatePath("/");
    return { ticket };
  });
