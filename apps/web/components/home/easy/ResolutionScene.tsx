'use client';

/**
 * ResolutionScene — the v4 interactive resolution scene (amendment F).
 *
 * One ruled document: the ledger on the left, the tally on the right. Three
 * states, never two at once:
 *
 *   idle       the eight rows of the REAL source registry, every one honestly
 *              "Not checked" because nothing has been read yet — the founder's
 *              v4 idle fixture carried ABIM reads, licence numbers, UCSF
 *              privileges and a demonstration NPI; standing law strips all of
 *              it (EC-25.2, EC-3), so the idle scene teaches the registry's
 *              actual lanes in the one state that is true before a lookup.
 *   resolving  the read log — the shared CHECK_SEQUENCE process narration
 *              (what we are DOING, never a result), no spinner, no percentage.
 *   resolved   the REAL rows from `buildEvidenceCapsule` via `NpiReveal` —
 *              the same recognition-moment contract the previous homepage ran.
 *
 * The tally counts rows by state and nothing else. Its caption is
 * load-bearing and verbatim from the founder's v4: "Counts are of lanes, not
 * a score. VitalCV does not grade clinicians."
 */

import { STATE_GLYPH, StateStamp, type HomeState } from '@/components/home/easy/stateVocabulary';
import { NpiReveal, ResolvingNarration } from '@/components/home/easy/NpiReveal';

import type { HeroLoop } from '@/components/home/easy/heroLoop';

/** The idle ledger: the real registry, nothing read yet. */
const IDLE_ROWS: ReadonlyArray<{
  claim: string;
  source: string;
  cadence: string;
  state: HomeState;
  stateWord: string;
}> = [
  { claim: 'NPI registry record', source: 'NPPES', cadence: 'read live', state: 'unchecked', stateWord: 'Not checked' },
  { claim: 'Name and specialty', source: 'NPPES', cadence: 'read live', state: 'unchecked', stateWord: 'Not checked' },
  { claim: 'Practice location', source: 'NPPES', cadence: 'read live', state: 'unchecked', stateWord: 'Not checked' },
  { claim: 'Exclusion screen', source: 'OIG LEIE', cadence: 'monthly snapshot', state: 'unchecked', stateWord: 'Not checked' },
  { claim: 'Medicare enrollment', source: 'PECOS', cadence: 'quarterly snapshot', state: 'unchecked', stateWord: 'Not checked' },
  { claim: 'State licensure', source: 'Licensure', cadence: 'access-gated', state: 'access', stateWord: 'Access required' },
  { claim: 'Employment history', source: 'No source yet', cadence: 'not read', state: 'unchecked', stateWord: 'Not checked' },
  { claim: 'Board certification', source: 'No source yet', cadence: 'not read', state: 'unchecked', stateWord: 'Not checked' },
];

function IdleLedger() {
  return (
    <ul className="ezh-ledger" data-home-idle-ledger="">
      {IDLE_ROWS.map((row) => (
        <li key={row.claim} className={`ezh-lrow is-${row.state}`}>
          <div className="ezh-lrow-main">
            <span className="ezh-lrow-claim">{row.claim}</span>
            <span className="ezh-lrow-bar" aria-hidden="true" />
            <span className="ezh-lrow-src">
              {row.source} · {row.cadence}
            </span>
          </div>
          <StateStamp state={row.state}>{row.stateWord}</StateStamp>
        </li>
      ))}
    </ul>
  );
}

function IdleTally() {
  return (
    <dl className="ezh-tally" data-home-tally="">
      <div className="ezh-tally-row">
        <dt>Not checked</dt>
        <dd className="ezh-data">7</dd>
      </div>
      <div className="ezh-tally-row">
        <dt>Access required</dt>
        <dd className="ezh-data">1</dd>
      </div>
      <div className="ezh-tally-row">
        <dt>Read so far</dt>
        <dd className="ezh-data">0</dd>
      </div>
    </dl>
  );
}

function ResolvedTally({ loop }: { loop: HeroLoop }) {
  const capsule = loop.state.capsule;
  if (!capsule || capsule.empty) return null;
  const count = (kind: 'returned' | 'attention' | 'unavailable') =>
    capsule.rows.filter((row) => row.kind === kind).length;
  return (
    <dl className="ezh-tally" data-home-tally="">
      <div className="ezh-tally-row">
        <dt>Returned by source</dt>
        <dd className="ezh-data">{count('returned')}</dd>
      </div>
      <div className="ezh-tally-row">
        <dt>Needs your attention</dt>
        <dd className="ezh-data">{count('attention')}</dd>
      </div>
      <div className="ezh-tally-row">
        <dt>Unavailable without access</dt>
        <dd className="ezh-data">{count('unavailable')}</dd>
      </div>
    </dl>
  );
}

export default function ResolutionScene({ loop }: { loop: HeroLoop }) {
  const { state, resolving, narrating, attempt, profile } = loop;
  const resolved = !narrating && profile !== null;

  return (
    <section
      id="record"
      className="ezh-res"
      data-home-resolution=""
      data-header-theme="light"
      aria-labelledby="ezh-res-h"
    >
      <div className="ezh-wrap">
        <div className="ezh-res-head">
          <span className="ezh-k" role="status">
            {resolved
              ? 'Returned by the live lookup'
              : narrating && attempt > 0
                ? 'Reading public sources'
                : 'Awaiting an NPI — nothing has been read yet'}
          </span>
          <span className="ezh-k ezh-res-legendline" aria-hidden="true">
            {STATE_GLYPH.confirmed} {STATE_GLYPH.snapshot} {STATE_GLYPH.attention} {STATE_GLYPH.access}{' '}
            {STATE_GLYPH.unchecked} · glyph, word, source, cadence
          </span>
        </div>

        <div className="ezh-res-shell">
          <div className="ezh-res-main">
            <h2 id="ezh-res-h">The record, as sources return it</h2>
            <p className="ezh-res-sub">
              Eight rows from the real source registry. Each carries glyph, word, source and
              cadence &mdash; never colour alone.
            </p>

            {narrating && attempt > 0 && state.phase !== 'invalid' ? (
              <ResolvingNarration key={attempt} done={!resolving} onSettled={loop.handleSettled} />
            ) : resolved && profile ? (
              <NpiReveal
                profile={profile}
                capsule={state.capsule}
                isDemo={state.isDemo}
                onKeep={loop.handleKeep}
                onReset={loop.handleReset}
              >
                {state.matchPhase === 'loading' ? (
                  <p className="ezh-result-note">Finding roles that fit&hellip;</p>
                ) : null}
                {state.matchPhase === 'loaded' && state.matches.length > 0 ? (
                  <ul className="ezh-result-matches">
                    {state.matches.slice(0, 3).map((match) => (
                      <li key={match.opportunityId || match.title} className="ezh-result-match">
                        <p className="ezh-result-match-title">{match.title}</p>
                        <p className="ezh-result-match-meta">
                          {[match.organizationName, match.location, match.hiringType]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {state.matchPhase === 'empty' ? (
                  <p className="ezh-result-note">
                    No open roles matched just now. The record still moves you forward &mdash;
                    keep it and VitalCV keeps watching.
                  </p>
                ) : null}
                {state.matchPhase === 'error' ? (
                  <p className="ezh-result-note">Role matching is unavailable right now.</p>
                ) : null}
              </NpiReveal>
            ) : (
              <IdleLedger />
            )}
          </div>

          <aside className="ezh-res-side">
            <h3 className="ezh-res-side-h">Where you stand</h3>
            <p className="ezh-res-caption">
              Counts are of lanes, not a score. VitalCV does not grade clinicians.
            </p>
            {resolved ? <ResolvedTally loop={loop} /> : <IdleTally />}
            {resolved && state.capsule?.nextAction ? (
              <div className="ezh-res-next">
                <span className="ezh-k">Next, and only you can do it</span>
                <p>{state.capsule.nextAction}</p>
              </div>
            ) : null}
            <p className="ezh-res-disclose">
              {resolved
                ? 'Shown to you only. Nothing here has been sent anywhere.'
                : 'Illustrative until a real lookup returns — these are the real sources, with nothing read yet.'}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
