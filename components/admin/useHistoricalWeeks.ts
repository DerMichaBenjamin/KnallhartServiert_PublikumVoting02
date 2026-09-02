'use client';

import { useEffect, useState } from 'react';
import type { ReleaseWeekStatistics } from '@/lib/releaseStatisticsCore';

type BatchResponse = {
  ok: boolean;
  weeks?: ReleaseWeekStatistics[];
  total?: number;
  nextOffset?: number | null;
  warnings?: string[];
  error?: string;
};

export function useHistoricalWeeks() {
  const [weeks, setWeeks] = useState<ReleaseWeekStatistics[]>([]);
  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setWeeks([]);
    setTotal(0);
    setProcessed(0);
    setWarnings([]);
    setError('');
    setLoading(true);

    async function load() {
      let offset: number | null = 0;
      try {
        while (offset !== null && !controller.signal.aborted) {
          const response = await fetch(`/api/admin/statistics/history?offset=${offset}&limit=2`, { signal: controller.signal, cache: 'no-store' });
          const payload = await response.json() as BatchResponse;
          if (!response.ok || !payload.ok) throw new Error(payload.error || 'Historische Daten konnten nicht geladen werden.');
          const incoming = payload.weeks || [];
          setWeeks((current) => {
            const byId = new Map(current.map((week) => [week.round.id, week]));
            incoming.forEach((week) => byId.set(week.round.id, week));
            return [...byId.values()];
          });
          setWarnings((current) => [...current, ...(payload.warnings || [])]);
          setTotal(payload.total || 0);
          const next = typeof payload.nextOffset === 'number' ? payload.nextOffset : null;
          setProcessed(next ?? (payload.total || offset + 2));
          offset = next;
        }
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Historische Daten konnten nicht geladen werden.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [retryKey]);

  return { weeks, total, processed: Math.min(processed, total || processed), warnings, error, loading, retry: () => setRetryKey((value) => value + 1) };
}
