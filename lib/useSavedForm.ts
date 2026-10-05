// The form lives in localStorage, read through useSyncExternalStore: it renders the empty form on
// the server, picks up the saved one in the browser, and stays in sync across tabs. If storage is
// unavailable (private mode, blocked site data), it quietly falls back to memory for this visit.

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { EMPTY_FORM, parseSaved, serializeForm, type FormState } from "./savedForm";

const KEY = "brake-even:form";
let memory: string | null = null;
let storage: Storage | null | undefined; // undefined until first checked
const listeners = new Set<() => void>();

function getStorage(): Storage | null {
  if (storage === undefined) {
    try {
      window.localStorage.setItem(`${KEY}:probe`, "1");
      window.localStorage.removeItem(`${KEY}:probe`);
      storage = window.localStorage;
    } catch {
      storage = null;
    }
  }
  return storage;
}

function read(): string | null {
  try {
    return getStorage()?.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function write(raw: string | null) {
  memory = raw;
  try {
    const s = getStorage();
    if (raw === null) s?.removeItem(KEY);
    else s?.setItem(KEY, raw);
  } catch {
    storage = null; // e.g. quota exceeded: keep going from memory
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** [form, update, startOver, hasSaved] */
export function useSavedForm(): [FormState, (change: (prev: FormState) => FormState) => void, () => void, boolean] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const form = useMemo(() => parseSaved(raw), [raw]);
  const update = useCallback((change: (prev: FormState) => FormState) => write(serializeForm(change(parseSaved(read())))), []);
  const startOver = useCallback(() => write(null), []);
  return [form, update, startOver, raw !== null && raw !== serializeForm(EMPTY_FORM)];
}
