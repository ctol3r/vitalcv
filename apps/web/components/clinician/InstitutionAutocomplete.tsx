'use client';

/**
 * InstitutionAutocomplete — a typeahead over the curated medical-institution
 * reference data (lib/institutions/curated.ts), scoped by kind. Used on the
 * clinician profile so institution fields are "pre-populated" with the real
 * vocabulary (medical schools, boards, societies…) as the clinician types,
 * instead of a blank box.
 *
 * Truth contract: selecting an entry is USER_ENTERED — a directory match, not a
 * verification. Persistence is the editable-profile wave; this component fills
 * the field locally and reports selections via onSelect.
 *
 * Accessibility: the WAI-ARIA combobox pattern (role=combobox + listbox,
 * aria-activedescendant, full keyboard nav) so it passes the axe gate.
 */

import * as React from 'react';
import { searchInstitutions, KIND_LABEL, type Institution, type InstitutionKind } from '@/lib/institutions/curated';

interface Props {
  id: string;
  kinds?: InstitutionKind[];
  placeholder?: string;
  ariaDescribedBy?: string;
  onSelect?: (inst: Institution) => void;
}

export function InstitutionAutocomplete({ id, kinds, placeholder, ariaDescribedBy, onSelect }: Props) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listId = `${id}-listbox`;

  const results = React.useMemo(
    () => (query.trim() ? searchInstitutions(query, { kinds, limit: 8 }) : []),
    [query, kinds],
  );

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const choose = (inst: Institution) => {
    setQuery(inst.name);
    setOpen(false);
    onSelect?.(inst);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(0, results.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      if (results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const activeId = open && results[active] ? `${id}-opt-${results[active].id}` : undefined;

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-describedby={ariaDescribedBy}
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => query.trim() && setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-[var(--vt-border,rgba(0,0,0,0.12))] bg-transparent px-3 py-2 text-sm placeholder:text-[var(--vt-text-muted,#888)] focus:outline-none focus:ring-2 focus:ring-offset-2"
      />
      {open && results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Institution suggestions"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[var(--vt-border,rgba(0,0,0,0.12))] bg-[var(--vt-surface,white)] py-1 shadow-lg"
        >
          {results.map((inst, i) => (
            <li
              key={inst.id}
              id={`${id}-opt-${inst.id}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus; fire before blur closes the list
                choose(inst);
              }}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${
                i === active ? 'bg-[var(--vt-surface-subtle,#f0f0ee)]' : ''
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-[var(--vt-text-primary)]">{inst.name}</span>
                <span className="block truncate text-[11px] text-[var(--vt-text-muted,#888)]">
                  {KIND_LABEL[inst.kind]}
                  {inst.city ? ` · ${inst.city}${inst.state ? `, ${inst.state}` : ''}` : ''}
                </span>
              </span>
              {inst.abbrev ? (
                <span className="shrink-0 font-mono text-[11px] text-[var(--vt-text-muted,#888)]">{inst.abbrev}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
