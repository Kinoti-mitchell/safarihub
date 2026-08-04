/** Per-tab session binding — sessionStorage is not shared across tabs. */

export const TAB_BIND_KEY = "safari_hub_tab_bind";
export const TAB_BIND_HEADER = "x-safari-tab-bind";

export function createTabBind(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function readTabBind(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(TAB_BIND_KEY);
  } catch {
    return null;
  }
}

export function writeTabBind(value: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TAB_BIND_KEY, value);
  } catch {
    // private mode / blocked storage — leave unbound
  }
}

export function clearTabBind(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(TAB_BIND_KEY);
  } catch {
    // ignore
  }
}
