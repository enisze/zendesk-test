import { config } from "@/server/config";
import {
  ZendeskError,
  zendeskRepository,
} from "@/repositories/zendesk-repository";
import { TicketsView } from "./tickets-view";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = Promise<{ after?: string; before?: string }>;

function readCursor(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const userId = config.demoUserId;
  const { after, before } = await searchParams;

  try {
    const result = await zendeskRepository.listCcTickets({
      userId,
      pageSize: PAGE_SIZE,
      after: readCursor(after),
      before: readCursor(before),
    });

    return (
      <main className="flex flex-1 w-full bg-zinc-50 dark:bg-black">
        <TicketsView
          userId={userId}
          initialTickets={result.tickets}
          initiallyCached={result.cached}
          hasMore={result.hasMore}
          afterCursor={result.afterCursor}
          beforeCursor={result.beforeCursor}
          isFirstPage={!after && !before}
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
