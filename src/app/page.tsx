import type { SearchParams } from "nuqs/server";
import { config } from "@/server/config";
import {
  ZendeskError,
  zendeskRepository,
} from "@/repositories/zendesk-repository";
import { paginationSearchParams } from "./search-params-cache";
import { TicketsView } from "./tickets-view";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const userId = config.demoUserId;
  const { after, before, size } =
    await paginationSearchParams.parse(searchParams);

  try {
    const result = await zendeskRepository.listCcTickets({
      userId,
      pageSize: size,
      after,
      before,
    });

    return (
      <main className="flex flex-1 w-full bg-zinc-50 dark:bg-black">
        <TicketsView
          userId={userId}
          tickets={result.tickets}
          cached={result.cached}
          hasMore={result.hasMore}
          afterCursor={result.afterCursor}
          beforeCursor={result.beforeCursor}
          isFirstPage={!after && !before}
          size={size}
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
