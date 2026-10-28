import { createContext, useContext, useEffect, useState } from "react";
import type { Services } from "../services";

export const ServicesContext = createContext<Services | null>(null);
export const ActiveContext = createContext(true);
export const useActive = () => useContext(ActiveContext);
export function useServices() {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("services unavailable");
  return services;
}
export type RemoteState<T> =
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "error"; error: unknown };
export function useRemote<T>(load: (signal: AbortSignal) => Promise<T>) {
  const active = useActive();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RemoteState<T>>({ kind: "loading" });
  useEffect(() => {
    setState({ kind: "loading" });
    if (!active) return;
    const controller = new AbortController();
    void load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ kind: "ready", data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ kind: "error", error });
      },
    );
    return () => controller.abort();
  }, [load, attempt, active]);
  return { state, reload: () => setAttempt((value) => value + 1) };
}
