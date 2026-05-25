import { NextResponse } from "next/server";
import { config } from "@/server/config";
import { ZendeskError, listCcTickets } from "@/server/zendesk";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { tickets, cached } = await listCcTickets(config.demoUserId);
    return NextResponse.json({
      userId: config.demoUserId,
      cached,
      tickets,
    });
  } catch (err) {
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
}
