'use client';

/**
 * useMatchaPreferences — the client binding between the clinician's stated preferences,
 * the browser's working copy, the durable account store, the derived "MATCHA understands
 * you" profile, and the live engine.
 *
 * Every read and write is scoped to the signed-in Clerk account. Before scoping, the hook
 * hydrated from one global localStorage key and marked itself loaded immediately, so a
 * second account signing in on the same browser — or a signed-out visitor — rendered
 * whoever used the device last as their own preference completeness and profile insights.
 * The server round-trip could not correct it either: a 401 or a degraded read was swallowed
 * and the surface kept showing the unbound local copy with no indication that is what it
 * was. Scoping the cache is the binding; {@link MatchaSyncStatus} is the disclosure.
 *
 * Writes land in the scoped browser copy immediately, and for a signed-in account are
 * pushed to /api/matcha/preferences. A write that does not land sets `unsaved` rather than
 * failing silently — including the route's `200 {ok:false}` degraded reply, which is a
 * failure wearing a success code.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useOptionalRoleContext } from '@/components/auth/RoleContext';
import {
  type MatchaPreferences,
  type PreferenceField,
  ENGINE_BACKED_FIELDS,
  completenessPercent,
  countAnsweredFields,
  sanitizeStoredPreferences,
  toCandidateIntent,
} from '@/lib/matcha/preferences';
import { deriveMatchaProfile, type MatchaDerivedProfile } from '@/lib/matcha/profile';
import {
  type MemoryNote,
  type PreferenceScope,
  DEVICE_SCOPE,
  accountScope,
  adoptUnboundPreferences,
  clearStoredPreferences,
  diffPreferences,
  discardUnboundPreferences,
  isAccountScope,
  loadStoredPreferences,
  readUnboundPreferences,
  savePreferences,
} from '@/lib/matcha/storage';
import { type MatchaSyncStatus, type MatchaSyncNotice, describeSync } from '@/lib/matcha/sync';

const RECENT_MEMORY_LIMIT = 8;

export interface UseMatchaPreferences {
  preferences: MatchaPreferences;
  derived: MatchaDerivedProfile;
  completeness: number;
  /** Grounded "MATCHA remembers" notes from the most recent edits, newest first. */
  memory: MemoryNote[];
  loaded: boolean;
  /** Where the preferences on screen live, and whether the account store answered. */
  sync: MatchaSyncStatus;
  /** True when the most recent durable write did not land. Always false when signed out. */
  unsaved: boolean;
  /** What to tell the reader about durability, or null when there is nothing to add. */
  notice: MatchaSyncNotice | null;
  /**
   * Answers found in the pre-scoping browser key that belong to no account. Present only
   * when signed in with nothing of this account's own to show. Ownership is unknowable
   * from storage, so the hook offers them rather than claiming them.
   */
  unboundDevicePreferences: MatchaPreferences | null;
  /** Claim {@link unboundDevicePreferences} for the signed-in account. */
  adoptDevicePreferences: () => void;
  /** Discard {@link unboundDevicePreferences} without attributing them to anyone. */
  dismissDevicePreferences: () => void;
  setField: (field: PreferenceField, value: MatchaPreferences[PreferenceField]) => void;
  reset: () => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function useMatchaPreferences(npi?: string): UseMatchaPreferences {
  const role = useOptionalRoleContext();
  // No provider mounted (isolated render): treat the session as resolved and signed out
  // rather than throwing. That lands on the device scope, which claims no account.
  const sessionLoaded = role ? role.sessionLoaded : true;
  const userId = role?.userId ?? null;
  const scope: PreferenceScope = userId ? accountScope(userId) : DEVICE_SCOPE;

  const [preferences, setPreferences] = useState<MatchaPreferences>({});
  const [loaded, setLoaded] = useState(false);
  const [memory, setMemory] = useState<MemoryNote[]>([]);
  const [sync, setSync] = useState<MatchaSyncStatus>('pending');
  const [unsaved, setUnsaved] = useState(false);
  const [unbound, setUnbound] = useState<MatchaPreferences | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flips true on the first local edit so an in-flight server hydration can
  // never clobber a live edit the clinician just made. Reset per scope.
  const userEditedRef = useRef(false);
  // The scope the previous render settled on, so leaving an account can evict it.
  const previousScopeRef = useRef<PreferenceScope | null>(null);
  // The scope writes belong to, read inside debounced timers that may fire after a
  // scope change. A timer must never write one account's answers into another's key.
  const scopeRef = useRef<PreferenceScope>(scope);
  scopeRef.current = scope;

  /**
   * Persist the full preference bag to the durable, auth-scoped account store so it
   * follows the provider across devices. Signed-out sessions have no account store and
   * never call it. A rejected fetch, a non-2xx, or the route's degraded `{ok:false}`
   * reply all mean the same thing to the clinician — their answer is in this browser
   * only — so all three raise `unsaved`.
   */
  const persistToServer = useCallback(
    async (prefs: MatchaPreferences, forScope: PreferenceScope) => {
      if (!isAccountScope(forScope)) return;
      try {
        const res = await fetch('/api/matcha/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences: prefs }),
          keepalive: true,
        });
        // The account switched while this write was in flight — its outcome says
        // nothing about the account now on screen.
        if (scopeRef.current !== forScope) return;
        if (!res.ok) {
          setUnsaved(true);
          setSync('degraded');
          return;
        }
        const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
        if (body?.ok === false) {
          setUnsaved(true);
          setSync('degraded');
          return;
        }
        setUnsaved(false);
        setSync('synced');
      } catch {
        if (scopeRef.current !== forScope) return;
        setUnsaved(true);
        setSync('degraded');
      }
    },
    [],
  );

  // Hydrate for the current scope: evict the account we just left, read this scope's
  // browser copy, then ask the account store. Re-runs on every account switch.
  useEffect(() => {
    // Identity unresolved — picking a bucket now would be a guess.
    if (!sessionLoaded) return;

    const previous = previousScopeRef.current;
    if (previous && previous !== scope && isAccountScope(previous)) {
      // Signing out of, or switching away from, an account on this browser. The
      // account store holds the durable copy; the local one has no reason to outlive
      // the session, and leaving it would let the next person on the device read it.
      clearStoredPreferences(previous);
    }
    previousScopeRef.current = scope;

    userEditedRef.current = false;
    const local = loadStoredPreferences(scope);
    setPreferences(local);
    setMemory([]);
    setUnsaved(false);
    setLoaded(true);

    if (!isAccountScope(scope)) {
      // Signed out. The browser is the store, by design and not by failure.
      setSync('device');
      setUnbound(null);
      return;
    }

    setSync('pending');
    let cancelled = false;
    void (async () => {
      let server: MatchaPreferences = {};
      let reachable = false;
      try {
        const res = await fetch('/api/matcha/preferences', { cache: 'no-store' });
        if (cancelled || scopeRef.current !== scope) return;
        const body = res.ok
          ? ((await res.json().catch(() => null)) as
              | { preferences?: unknown; degraded?: boolean }
              | null)
          : null;
        // A 401 means this session has no account store to read, whatever the client
        // believes about being signed in; a degraded read means the store could not
        // answer. Neither is an empty account, and neither may be shown as one.
        reachable = res.ok && body?.degraded !== true;
        server = sanitizeStoredPreferences(body?.preferences ?? {});
      } catch {
        reachable = false;
      }
      if (cancelled || scopeRef.current !== scope) return;

      setSync(reachable ? 'synced' : 'degraded');

      // The clinician started editing while this GET was in flight — their live edit
      // (already persisted via its own PUT) wins; never overwrite it.
      if (userEditedRef.current) return;

      if (reachable && countAnsweredFields(server) > 0) {
        setPreferences(server);
        savePreferences(scope, server, nowIso());
        setUnbound(null);
        return;
      }

      if (reachable && countAnsweredFields(local) > 0) {
        // This account's own browser copy predates the account store — migrate it up.
        void persistToServer(local, scope);
        setUnbound(null);
        return;
      }

      // Nothing for this account anywhere. If the browser still holds pre-scoping
      // answers, offer them; they may be this clinician's or the last person's, and
      // storage cannot tell us which.
      if (countAnsweredFields(local) === 0) {
        const orphan = readUnboundPreferences();
        setUnbound(countAnsweredFields(orphan) > 0 ? orphan : null);
      } else {
        setUnbound(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, sessionLoaded, persistToServer]);

  // Debounced durable persistence so rapid answers collapse into one write.
  const pushPrefs = useCallback(
    (next: MatchaPreferences, forScope: PreferenceScope) => {
      if (!isAccountScope(forScope)) return;
      if (prefsTimer.current) clearTimeout(prefsTimer.current);
      prefsTimer.current = setTimeout(() => {
        if (scopeRef.current !== forScope) return;
        void persistToServer(next, forScope);
      }, 800);
    },
    [persistToServer],
  );

  const pushIntent = useCallback(
    (next: MatchaPreferences, forScope: PreferenceScope) => {
      if (!npi) return;
      const engineTouched = ENGINE_BACKED_FIELDS.some(
        (f) => next[f] !== undefined && next[f] !== null,
      );
      if (!engineTouched) return;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      // Debounce so rapid answers collapse into one request.
      pushTimer.current = setTimeout(() => {
        if (scopeRef.current !== forScope) return;
        const payload = toCandidateIntent(npi, next, nowIso());
        void fetch('/api/matcha/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {
          /* the engine hint is best-effort; the answer itself is already stored */
        });
      }, 600);
    },
    [npi],
  );

  const setField = useCallback(
    (field: PreferenceField, value: MatchaPreferences[PreferenceField]) => {
      userEditedRef.current = true;
      const writeScope = scopeRef.current;
      setPreferences((prev) => {
        const next: MatchaPreferences = { ...prev, [field]: value };
        const notes = diffPreferences(prev, next, [field]);
        if (notes.length) {
          setMemory((m) => [...notes, ...m].slice(0, RECENT_MEMORY_LIMIT));
        }
        savePreferences(writeScope, next, nowIso());
        pushIntent(next, writeScope);
        pushPrefs(next, writeScope);
        return next;
      });
      // An edit supersedes an adoption offer — the account now has answers of its own.
      setUnbound(null);
    },
    [pushIntent, pushPrefs],
  );

  const reset = useCallback(() => {
    userEditedRef.current = true;
    const writeScope = scopeRef.current;
    clearStoredPreferences(writeScope);
    setPreferences({});
    setMemory([]);
    // Clearing is an edit like any other: push the empty bag so the account store
    // stops serving answers the clinician just removed.
    pushPrefs({}, writeScope);
  }, [pushPrefs]);

  const adoptDevicePreferences = useCallback(() => {
    const writeScope = scopeRef.current;
    if (!isAccountScope(writeScope)) return;
    const adopted = adoptUnboundPreferences(writeScope, nowIso());
    setUnbound(null);
    if (countAnsweredFields(adopted) === 0) return;
    userEditedRef.current = true;
    setPreferences(adopted);
    pushIntent(adopted, writeScope);
    pushPrefs(adopted, writeScope);
  }, [pushIntent, pushPrefs]);

  const dismissDevicePreferences = useCallback(() => {
    discardUnboundPreferences();
    setUnbound(null);
  }, []);

  useEffect(
    () => () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
      if (prefsTimer.current) clearTimeout(prefsTimer.current);
    },
    [],
  );

  const derived = useMemo(() => deriveMatchaProfile(preferences), [preferences]);
  const completeness = useMemo(() => completenessPercent(preferences), [preferences]);
  const notice = useMemo(() => describeSync(sync, unsaved), [sync, unsaved]);

  return {
    preferences,
    derived,
    completeness,
    memory,
    loaded,
    sync,
    unsaved,
    notice,
    unboundDevicePreferences: unbound,
    adoptDevicePreferences,
    dismissDevicePreferences,
    setField,
    reset,
  };
}
