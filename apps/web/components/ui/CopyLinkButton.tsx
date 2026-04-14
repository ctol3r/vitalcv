'use client';

import React from 'react';

export function CopyLinkButton() {
  return (
    <button
      onClick={() => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        const btn = document.getElementById('copy-link-btn');
        if (btn) {
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = 'Copy Link';
          }, 2000);
        }
      }}
      id="copy-link-btn"
      className="rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-border"
    >
      Copy Link
    </button>
  );
}
