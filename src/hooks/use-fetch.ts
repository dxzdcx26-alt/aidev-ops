"use client";

import { useEffect, useState } from "react";

type FetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  mock: boolean;
};

export function useFetch<T>(url: string | null, deps: unknown[] = []): FetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null, mock: false });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) {
      const t = setTimeout(() => setState({ data: null, loading: false, error: null, mock: false }), 0);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    const t = setTimeout(() => setState((s) => ({ ...s, loading: true, error: null })), 0);
    fetch(url)
      .then(async (r) => {
        const json = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setState({ data: null, loading: false, error: json.error ?? `HTTP ${r.status}`, mock: false });
          return;
        }
        const mock = Boolean(json.mock ?? false);
        delete json.mock;
        setState({ data: json, loading: false, error: null, mock });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ data: null, loading: false, error: err.message, mock: false });
      });
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [url, nonce]);

  return { ...state, refetch: () => setNonce((n) => n + 1) };
}
