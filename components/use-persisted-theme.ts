"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const THEME_EVENT_NAME = "synaptic-theme-change";

function readTheme(storageKey: string): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = window.localStorage.getItem(storageKey);

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeThemeChange(storageKey: string, callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === storageKey) {
      callback();
    }
  };
  const handleThemeEvent = (event: Event) => {
    const customEvent = event as CustomEvent<string>;

    if (!customEvent.detail || customEvent.detail === storageKey) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(THEME_EVENT_NAME, handleThemeEvent as EventListener);
  media.addEventListener("change", callback);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(THEME_EVENT_NAME, handleThemeEvent as EventListener);
    media.removeEventListener("change", callback);
  };
}

export function usePersistedTheme(storageKey: string) {
  const theme: Theme = useSyncExternalStore(
    (callback) => subscribeThemeChange(storageKey, callback),
    () => readTheme(storageKey),
    () => "light",
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, theme);
  }, [storageKey, theme]);

  const setTheme = (nextTheme: Theme) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, nextTheme);
    window.dispatchEvent(new CustomEvent(THEME_EVENT_NAME, { detail: storageKey }));
  };

  return { theme, setTheme };
}