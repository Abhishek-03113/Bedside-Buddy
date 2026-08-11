/**
 * Development-only performance counters.
 * Enable with COOSY_PERF=1 (main + renderer). No-op when unset.
 */

export type PerfCounterName =
  | "homeScreen.render"
  | "sourceTile.render"
  | "focus.nav"
  | "focus.dom"
  | "keydown.handler"
  | "ipc.invoke"
  | "sourceHost.setBounds"
  | "sourceHost.setBounds.skipped"
  | "sourceHost.showSource"
  | "sourceHost.showSource.noop"
  | "sourceHost.createView"
  | "sourceHost.attach"
  | "sourceHost.detach"
  | "sourceHost.showHide"
  | "db.write"
  | "db.write.skipped"
  | "toast.show"
  | "listener.register"
  | "listener.cleanup"
  | "resizeObserver.measure"
  | "resizeObserver.columnsChanged";

const enabled =
  typeof process !== "undefined" &&
  process.env?.COOSY_PERF === "1";

const counts = new Map<string, number>();

export function perfEnabled(): boolean {
  return enabled;
}

export function perfInc(name: PerfCounterName, by = 1): void {
  if (!enabled) return;
  counts.set(name, (counts.get(name) ?? 0) + by);
}

export function perfGet(name: PerfCounterName): number {
  return counts.get(name) ?? 0;
}

export function perfSnapshot(): Record<string, number> {
  return Object.fromEntries(counts.entries());
}

export function perfReset(): void {
  counts.clear();
}

/** Test helper — force-count regardless of COOSY_PERF (tests call directly). */
export function perfIncAlways(name: PerfCounterName, by = 1): void {
  counts.set(name, (counts.get(name) ?? 0) + by);
}
