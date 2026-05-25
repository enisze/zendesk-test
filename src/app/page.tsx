import { config } from "@/server/config";
import {
  ZendeskError,
  zendeskRepository,
} from "@/repositories/zendesk-repository";
import { TicketsView } from "./tickets-view";

export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = config.demoUserId;

  try {
    const { tickets, cached } = await zendeskRepository.listCcTickets(userId);
    return (
      <main className="flex flex-1 w-full bg-zinc-50 dark:bg-black">
        <TicketsView
          userId={userId}
          initialTickets={tickets}
          initiallyCached={cached}
        />
      </main>
    );
  } catch (err) {
    const message =
      err instanceof ZendeskError
        ? `Zendesk error: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Unknown error";

    return (
      <main className="flex flex-1 w-full items-center justify-center bg-zinc-50 px-6 dark:bg-black">
        <div className="max-w-lg rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">Failed to load tickets.</p>
          <p className="mt-1 break-words">{message}</p>
        </div>
      </main>
    );
  }
}
