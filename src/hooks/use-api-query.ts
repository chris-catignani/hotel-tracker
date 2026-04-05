"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

interface QueryError {
  status: number;
  error: Error;
}

interface UseApiQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: QueryError | null;
  clearError: () => void;
  refetch: () => void;
}

export function useApiQuery<T>(
  url: string,
  opts?: { onError?: (err: QueryError) => void }
): UseApiQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<QueryError | null>(null);

  // Capture onError in a ref so identity changes don't cause re-fetches
  const onErrorRef = useRef(opts?.onError);
  useEffect(() => {
    onErrorRef.current = opts?.onError;
  });

  // fetchId ensures stale responses are discarded
  const fetchIdRef = useRef(0);

  const doFetch = useCallback(async () => {
    const id = ++fetchIdRef.current;
    setLoading(true);
    const result = await apiFetch<T>(url);
    if (id !== fetchIdRef.current) return; // stale — a newer fetch is in flight
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      const queryError: QueryError = { status: result.status, error: result.error };
      setError(queryError);
      onErrorRef.current?.(queryError);
    }
    setLoading(false);
  }, [url]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    doFetch();
  }, [doFetch]);

  const clearError = useCallback(() => setError(null), []);
  const refetch = useCallback(() => {
    doFetch();
  }, [doFetch]);

  return { data, loading, error, clearError, refetch };
}
