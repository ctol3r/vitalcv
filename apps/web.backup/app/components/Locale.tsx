"use client";

export default function Locale() {
  function setLocale(locale: string) {
    localStorage.setItem('vitalcv_locale', locale);
    // In a real implementation, this would trigger i18n update
    // For now, just store it
  }

  return (
    <div className="text-xs flex gap-2">
      <button
        onClick={() => setLocale('en')}
        className="hover:underline"
      >
        EN
      </button>
      <span>|</span>
      <button
        onClick={() => setLocale('es')}
        className="hover:underline"
      >
        ES
      </button>
    </div>
  );
}

