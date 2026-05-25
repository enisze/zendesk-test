import { TicketsView } from "./tickets-view";

export default function Home() {
  return (
    <main className="flex flex-1 w-full bg-zinc-50 dark:bg-black">
      <TicketsView />
    </main>
  );
}
