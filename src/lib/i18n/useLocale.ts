import { create } from "zustand";
import { locales, type Locale, type TranslationKey } from "./locales";

const LOCALE_STORAGE_KEY = "flowmaid-locale";

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (saved === "ja" || saved === "en") return saved;
  const lang = navigator.language;
  return lang.startsWith("ja") ? "ja" : "en";
}

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()((set) => ({
  locale: "en",
  setLocale: (locale: Locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    set({ locale });
  },
}));

// Hydrate on client side
if (typeof window !== "undefined") {
  useLocaleStore.setState({ locale: detectLocale() });
}

/** Hook that returns { locale, setLocale, t } — re-renders when locale changes */
export function useLocale() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = (key: TranslationKey) => locales[locale][key];
  return { locale, setLocale, t };
}
