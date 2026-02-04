"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Trade, 
  getTrades, 
  loadTradesFromDB, 
  updateCache, 
  invalidateCache,
  isCacheValid,
  getTradeLabel as getLabel,
  getTradeOptions as getOptions
} from "@/lib/trades";

// Re-export für einfachen Import
export type { Trade };
export { getLabel as getTradeLabel, getOptions as getTradeOptions, invalidateCache as invalidateTradesCache };

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>(getTrades());
  const [loading, setLoading] = useState(!isCacheValid());
  const supabase = createClient();

  useEffect(() => {
    if (isCacheValid()) {
      setTrades(getTrades());
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const data = await loadTradesFromDB(supabase);
        setTrades(data);
      } catch (e) {
        console.error("Failed to load trades:", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { trades, loading };
}
