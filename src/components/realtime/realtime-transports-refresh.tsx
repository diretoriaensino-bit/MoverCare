"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RealtimeTransportsRefreshProps = {
  hospitalId: string;
};

export function RealtimeTransportsRefresh({
  hospitalId
}: RealtimeTransportsRefreshProps) {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hospitalId) {
      return;
    }

    const supabase = createClient();

    function refreshPage() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        router.refresh();
      }, 700);
    }

    const channel = supabase
      .channel(`transports-refresh-${hospitalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transports"
        },
        () => {
          refreshPage();
        }
      )
      .subscribe();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      supabase.removeChannel(channel);
    };
  }, [hospitalId, router]);

  return null;
}

export default RealtimeTransportsRefresh;