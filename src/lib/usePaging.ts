import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PAGE_SIZES } from "../components/ui";

/**
 * The current page (0-based) kept in the address bar as ?page=2, so Back, reload and a shared link all return to the
 * same page. Page 1 leaves the address clean.
 */
export function usePageParam(): [number, (page: number) => void] {
  const [params, setParams] = useSearchParams();
  const page = Math.max(0, (Number.parseInt(params.get("page") ?? "1", 10) || 1) - 1);
  const setPage = useCallback(
    (next: number) => {
      setParams(
        (current) => {
          const out = new URLSearchParams(current);
          if (next <= 0) out.delete("page");
          else out.set("page", String(next + 1));
          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [page, setPage];
}

/** Rows per page, remembered per list in this browser. Falls back to 25 when storage is blocked or holds a bad value. */
export function usePageSize(key: string, fallback = 25): [number, (size: number) => void] {
  const storageKey = `pg_page_size_${key}`;
  const [size, setSize] = useState<number>(() => {
    try {
      const stored = Number(localStorage.getItem(storageKey));
      return PAGE_SIZES.includes(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  });
  const update = useCallback(
    (next: number) => {
      setSize(next);
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        /* storage blocked: the choice lasts until reload */
      }
    },
    [storageKey],
  );
  return [size, update];
}
