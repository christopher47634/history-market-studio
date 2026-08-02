import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { figures as embeddedFigures } from "./data.js";
import { buildComparison, getTurningPoints } from "./data.js";

const HistoryDataContext = createContext({
  figures: embeddedFigures,
  status: "embedded",
  meta: null,
  lastSyncedAt: null,
  refresh: async () => {},
});

export function HistoryDataProvider({ children }) {
  const [figures, setFigures] = useState(embeddedFigures);
  const [status, setStatus] = useState("connecting");
  const [meta, setMeta] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const refresh = useCallback(async (signal) => {
    setStatus((current) => (current === "live" ? "refreshing" : "connecting"));
    try {
      const response = await fetch("/api/figures", {
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) throw new Error(`history api ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.figures) || payload.figures.length < 100) {
        throw new Error("history api returned an incomplete catalog");
      }
      setFigures(payload.figures);
      setMeta(payload.meta || null);
      setLastSyncedAt(new Date());
      setStatus("live");
    } catch (error) {
      if (error?.name === "AbortError") return;
      setFigures(embeddedFigures);
      setStatus("embedded");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const value = useMemo(
    () => ({ figures, status, meta, lastSyncedAt, refresh }),
    [figures, status, meta, lastSyncedAt, refresh],
  );

  return (
    <HistoryDataContext.Provider value={value}>
      {children}
    </HistoryDataContext.Provider>
  );
}

export function useHistoryData() {
  return useContext(HistoryDataContext);
}

export function useHistoryComparison(left, right) {
  const fallbackComparison = useMemo(
    () => buildComparison(left, right),
    [left, right],
  );
  const fallbackEvents = useMemo(
    () => getTurningPoints(fallbackComparison, left, right),
    [fallbackComparison, left, right],
  );
  const [remote, setRemote] = useState(null);
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    const controller = new AbortController();
    setRemote(null);
    setStatus("connecting");
    const params = new URLSearchParams({ left: left.id, right: right.id });
    fetch(`/api/compare?${params}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`comparison api ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (!payload?.comparison || !Array.isArray(payload?.turningPoints)) {
          throw new Error("comparison api returned invalid data");
        }
        setRemote(payload);
        setStatus("live");
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setStatus("embedded");
      });
    return () => controller.abort();
  }, [left.id, right.id]);

  return {
    comparison: remote?.comparison || fallbackComparison,
    events: remote?.turningPoints || fallbackEvents,
    colors: remote?.colors || null,
    status,
  };
}
