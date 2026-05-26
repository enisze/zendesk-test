import "server-only";
import { createSafeActionClient } from "next-safe-action";
import { ZendeskError } from "@/repositories/zendesk-repository";

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
    public readonly scope: "user" | "global",
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export const actionClient = createSafeActionClient({
  handleServerError(error) {
    if (error instanceof RateLimitError) {
      return `${error.message} Try again in ${error.retryAfterSeconds}s.`;
    }
    if (error instanceof ZendeskError) {
      return `Zendesk error (${error.status}): ${error.message}`;
    }
    console.error("Unhandled action error:", error);
    return "Something went wrong.";
  },
});
