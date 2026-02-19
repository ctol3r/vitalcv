/**
 * Inline script to prevent dark mode flash on page load.
 * Runs synchronously before React hydrates.
 * Reads user preference from localStorage, falls back to OS preference.
 *
 * Note: dangerouslySetInnerHTML is safe here — the script content is a
 * hardcoded string literal with zero user input. This is the standard
 * Next.js pattern for blocking theme scripts.
 */
export function ThemeScript() {
  const themeInit = [
    '(function(){',
    'try{',
    "var t=localStorage.getItem('theme');",
    "if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches)){",
    "document.documentElement.classList.add('dark')",
    '}',
    '}catch(e){}',
    '})()',
  ].join('');

  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: themeInit }} />;
}
