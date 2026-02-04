// Zentrale Gewerke-Definition mit DB-Synchronisation

export interface Trade {
  slug: string;
  label: string;
  color?: string;
  is_active?: boolean;
  sort_order?: number;
}

// Fallback falls DB nicht erreichbar
const FALLBACK_TRADES: Trade[] = [
  { slug: "elektriker", label: "Elektriker" },
  { slug: "dachdecker", label: "Dachdecker" },
  { slug: "zimmerer", label: "Zimmerer" },
  { slug: "dc_montage", label: "DC-Montage" },
  { slug: "ac_montage", label: "AC-Montage" },
  { slug: "sanitaer", label: "Sanitär" },
  { slug: "heizung", label: "Heizung" },
  { slug: "klima", label: "Klima" },
  { slug: "geruestbau", label: "Gerüstbau" },
  { slug: "allround", label: "Allround" },
];

// Singleton Cache
let tradesCache: Trade[] = FALLBACK_TRADES;
let labelCache: Record<string, string> = Object.fromEntries(
  FALLBACK_TRADES.map(t => [t.slug, t.label])
);
let cacheTime = 0;
let cacheSource: 'fallback' | 'db' = 'fallback';
let loadingPromise: Promise<Trade[]> | null = null; // Verhindert mehrfache gleichzeitige DB-Abfragen
const CACHE_TTL = 60 * 1000; // 1 Minute (kürzer für schnellere Updates)

// Synchrone Label-Funktion (nutzt Cache)
export function getTradeLabel(trade: string | null | undefined): string {
  if (!trade) return "–";
  const label = labelCache[trade];
  if (!label) {
    console.warn(`[trades] Unknown trade slug: "${trade}" (cache source: ${cacheSource})`);
    return trade.replace(/_/g, "-");
  }
  return label;
}

// Debug: Cache-Status
export function getCacheStatus(): { source: string; count: number; age: number } {
  return {
    source: cacheSource,
    count: tradesCache.length,
    age: cacheTime ? Math.round((Date.now() - cacheTime) / 1000) : -1
  };
}

// Options für Dropdowns
export function getTradeOptions(): { value: string; label: string }[] {
  return tradesCache.map(t => ({ value: t.slug, label: t.label }));
}

// Trades Array
export function getTrades(): Trade[] {
  return tradesCache;
}

// Cache noch gültig?
export function isCacheValid(): boolean {
  return cacheTime > 0 && Date.now() - cacheTime < CACHE_TTL;
}

// Async: Trades aus DB laden
export async function loadTradesFromDB(supabase: any, force = false): Promise<Trade[]> {
  // Wenn Cache gültig und kein Force, sofort zurückgeben
  if (!force && isCacheValid()) {
    return tradesCache;
  }

  // Wenn bereits eine Abfrage läuft, auf diese warten (verhindert Race Conditions)
  if (loadingPromise) {
    return loadingPromise;
  }

  // Neue Abfrage starten
  loadingPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("trades")
        .select("slug, label, color, is_active, sort_order")
        .eq("is_active", true)
        .order("sort_order");

      if (error) {
        console.error("[trades] DB query failed:", error.message);
        return tradesCache;
      }

      if (data && data.length > 0) {
        console.log(`[trades] Loaded ${data.length} trades from DB`);
        updateCache(data, 'db');
        return data;
      } else {
        console.warn("[trades] DB returned empty, using fallback");
      }
    } catch (err) {
      console.error("[trades] Error loading trades:", err);
    } finally {
      loadingPromise = null; // Reset für nächsten Aufruf
    }

    return tradesCache;
  })();

  return loadingPromise;
}

// Cache aktualisieren (von außen aufrufbar)
export function updateCache(trades: Trade[], source: 'fallback' | 'db' = 'db') {
  tradesCache = trades;
  labelCache = Object.fromEntries(trades.map(t => [t.slug, t.label]));
  cacheTime = Date.now();
  cacheSource = source;
}

// Cache invalidieren
export function invalidateCache() {
  cacheTime = 0;
}

// Legacy exports für Kompatibilität
export const TRADES = FALLBACK_TRADES.map(t => ({ value: t.slug, label: t.label }));
export const TRADE_LABELS = labelCache;
