"use client";

import { Splash } from "@/components/brand/Splash";
import { ScreenError } from "@/components/ui/ScreenError";
import { HomeView } from "@/features/home/HomeView";
import { useMe, useRoom } from "@/lib/api/queries";

export default function HomePage() {
  const room = useRoom();
  const me = useMe();
  if (room.isError) return <ScreenError onRetry={() => room.refetch()} />;
  if (!room.data) return <Splash />;
  return <HomeView room={room.data} loggedIn={!!me.data} />;
}
