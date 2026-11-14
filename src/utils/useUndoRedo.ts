import { useCallback, useRef, useState } from "react";

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface SetHistoryOptions {
  /** When true (default), pushes previous state onto undo stack. */
  recordHistory?: boolean;
  /** Group consecutive rapid changes with the same key (e.g., slider drags or text typing) into a single undo step. */
  coalesceKey?: string;
  /** Coalesce window in milliseconds (default 650ms). */
  coalesceMs?: number;
}

export function useUndoRedo<T>(
  initialState: T | (() => T),
  maxHistory = 60
) {
  const [history, setHistory] = useState<HistoryState<T>>(() => {
    const resolved =
      typeof initialState === "function"
        ? (initialState as () => T)()
        : initialState;
    return {
      past: [],
      present: resolved,
      future: [],
    };
  });

  const lastCoalesceRef = useRef<{ key: string; time: number } | null>(null);

  const set = useCallback(
    (
      updater: T | ((prev: T) => T),
      options: SetHistoryOptions = {}
    ) => {
      const {
        recordHistory = true,
        coalesceKey,
        coalesceMs = 650,
      } = options;

      const now = Date.now();
      const prevCoalesce = lastCoalesceRef.current;
      const shouldCoalesce =
        Boolean(coalesceKey) &&
        prevCoalesce !== null &&
        prevCoalesce.key === coalesceKey &&
        now - prevCoalesce.time < coalesceMs;

      if (coalesceKey) {
        lastCoalesceRef.current = { key: coalesceKey, time: now };
      } else {
        lastCoalesceRef.current = null;
      }

      setHistory((prev) => {
        const nextPresent =
          typeof updater === "function"
            ? (updater as (p: T) => T)(prev.present)
            : updater;

        if (Object.is(nextPresent, prev.present)) {
          return prev;
        }

        if (!recordHistory) {
          return {
            ...prev,
            present: nextPresent,
          };
        }

        if (shouldCoalesce && prev.past.length > 0) {
          // Update present in place without adding another undo step for the same continuous gesture
          return {
            ...prev,
            present: nextPresent,
            future: [],
          };
        }

        const nextPast = [...prev.past, prev.present];
        if (nextPast.length > maxHistory) {
          nextPast.shift();
        }

        return {
          past: nextPast,
          present: nextPresent,
          future: [],
        };
      });
    },
    [maxHistory]
  );

  const undo = useCallback(() => {
    lastCoalesceRef.current = null;
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const nextPast = prev.past.slice(0, -1);
      return {
        past: nextPast,
        present: previous,
        future: [prev.present, ...prev.future].slice(0, maxHistory),
      };
    });
  }, [maxHistory]);

  const redo = useCallback(() => {
    lastCoalesceRef.current = null;
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const nextFuture = prev.future.slice(1);
      const nextPast = [...prev.past, prev.present];
      if (nextPast.length > maxHistory) {
        nextPast.shift();
      }
      return {
        past: nextPast,
        present: next,
        future: nextFuture,
      };
    });
  }, [maxHistory]);

  const reset = useCallback((nextInitial: T) => {
    lastCoalesceRef.current = null;
    setHistory({
      past: [],
      present: nextInitial,
      future: [],
    });
  }, []);

  return {
    state: history.present,
    setState: set,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undoCount: history.past.length,
    redoCount: history.future.length,
  };
}
