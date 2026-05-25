import { NextResponse } from "next/server";
import { config } from "@/server/config";
import { checkRemoveCcRateLimit } from "@/server/rate-limit";
import { ZendeskError, addUserToCc, removeUserFromCc } from "@/server/zendesk";

export const dynamic = "force-dynamic";

function parseTicketId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function handleError(err: unknown) {
  if (err instanceof ZendeskError) {
    return NextResponse.json(
      { error: "zendesk_error", message: err.message },
      { status: 502 },
    );
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json(
    { error: "server_error", message },
    { status: 500 },
  );
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const ticketId = parseTicketId(id);
  if (ticketId === null) {
    return NextResponse.json({ error: "invalid_ticket_id" }, { status: 400 });
  }

  const userId = config.demoUserId;
  const limit = checkRemoveCcRateLimit(userId);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        scope: limit.scope,
        retryAfterSeconds: limit.retryAfter,
        message:
          limit.scope === "user"
            ? "Rate limit: 1 remove-from-CC per user per minute."
            : "Rate limit: 3 remove-from-CC globally per minute.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      },
    );
  }

  try {
    const ticket = await removeUserFromCc(ticketId, userId);
    return NextResponse.json({ ticket });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const ticketId = parseTicketId(id);
  if (ticketId === null) {
    return NextResponse.json({ error: "invalid_ticket_id" }, { status: 400 });
  }

  try {
    const ticket = await addUserToCc(ticketId, config.demoUserId);
    return NextResponse.json({ ticket });
  } catch (err) {
    return handleError(err);
  }
}
