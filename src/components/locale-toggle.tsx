"use client";

import { useRouter } from "next/navigation";
import { parseLocale, type Locale } from "@/lib/i18n";

const COOKIE = "sh_locale";

export function LocaleToggle({ initial }: { initial?: string }) {
  const router = useRouter();
  const locale = parseLocale(initial);

  function setLocale(next: Locale) {
    document.cookie = `${COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    router.refresh();
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-line/80 bg-white/70 p-0.5 text-xs font-medium"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-full px-2 py-1 transition ${
          locale === "en"
            ? "bg-lake text-sand"
            : "text-ink-muted hover:text-ink"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("sw")}
        className={`rounded-full px-2 py-1 transition ${
          locale === "sw"
            ? "bg-lake text-sand"
            : "text-ink-muted hover:text-ink"
        }`}
      >
        SW
      </button>
    </div>
  );
}

export { COOKIE as LOCALE_COOKIE };
