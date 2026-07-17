'use client'

/**
 * MATCHA Deck — the swipe discovery stage (PR J1).
 *
 * Interaction contract:
 * - Drag right / → / S / Interested button  ⇒ Interested (saves, never applies)
 * - Drag left / ← / P / Pass button         ⇒ Pass (private)
 * - Drag up / ↑ / Enter / Details button    ⇒ Details, deck position preserved
 * - Priority button                          ⇒ Priority (separate save group)
 * - Z / Cmd+Z / Undo button                  ⇒ one-step undo, exact restore
 *
 * Every gesture has a button and keyboard equivalent; reduced motion swaps
 * flights for instant transitions; a polite live region announces position
 * and decisions. Pointer work stays on MotionValues — no React state updates
 * per pointer frame. A single shared `progress` MotionValue (0..1 = how far
 * the top card is committed) drives the under-card choreography so drag,
 * commit flight, and undo all stay visually continuous.
 */

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'framer-motion'

import { DeckDetailSheet } from './DeckDetailSheet'
import { MatchaDeckCard } from './MatchaDeckCard'
import {
  activeRecommendation,
  createDeckState,
  deckTransition,
  interestedQueue,
  isDeckExhausted,
  matchSummaryText,
  overallLabelText,
  passedHistory,
  type DeckEvent,
  type DeckState,
} from './deckMachine'
import type { DeckDecision, DeckRecommendation, DeckSignal, DeckSource } from './types'

const COMMIT_VELOCITY = 700 // px per second, per the interaction spec
const MAX_ROTATION = 7 // degrees
const EXIT_DURATION = 0.38 // seconds — inside the 320–480ms window
const RETURN_DURATION = 0.45 // undo re-entry — inside the 350–550ms window
const EASE: [number, number, number, number] = [0.2, 0.7, 0.2, 1]

function commitDistanceFor(width: number): number {
  return Math.min(120, width * 0.28)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

interface ExitTarget {
  x: number
  y: number
}

function exitTargetFor(decision: DeckDecision, width: number): ExitTarget {
  if (decision === 'passed') return { x: -width * 1.4, y: 0 }
  if (decision === 'interested') return { x: width * 1.4, y: 0 }
  return { x: width * 0.18, y: -720 } // priority — rises out of the deck
}

/* ------------------------------------------------------------------ */
/* Card shell: one card in the stack (active card owns the gesture)    */
/* ------------------------------------------------------------------ */

interface DeckCardShellProps {
  recommendation: DeckRecommendation
  depth: 0 | 1 | 2
  progress: MotionValue<number>
  exitingDecision: DeckDecision | null
  entryDecision: DeckDecision | null
  reducedMotion: boolean
  onDragCommit: (decision: DeckDecision) => void
  onDragDetails: () => void
  onExitComplete: (decision: DeckDecision) => void
}

function DeckCardShell({
  recommendation,
  depth,
  progress,
  exitingDecision,
  entryDecision,
  reducedMotion,
  onDragCommit,
  onDragDetails,
  onExitComplete,
}: DeckCardShellProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const active = depth === 0

  // Entry position: a card restored by undo flies back in from where it left.
  const [initialEntry] = useState<ExitTarget | null>(() =>
    entryDecision ? exitTargetFor(entryDecision, 480) : null,
  )

  const x = useMotionValue(initialEntry && !reducedMotion ? initialEntry.x : 0)
  const y = useMotionValue(initialEntry && !reducedMotion ? initialEntry.y : 0)
  const rotate = useTransform(x, [-360, 360], [-MAX_ROTATION, MAX_ROTATION])
  const interestedOpacity = useTransform(x, [16, 104], [0, 1])
  const passOpacity = useTransform(x, [-104, -16], [1, 0])
  const detailsOpacity = useTransform(y, [-104, -16], [1, 0])

  // Under-card choreography: depth targets derived from the shared commit
  // progress so drag, flight, and undo stay continuous (no position jumps
  // when a card changes depth).
  const holderScale = useTransform(progress, (p) => {
    if (depth === 1) return 0.962 + 0.038 * p
    if (depth === 2) return 0.925 + 0.037 * p
    return 1
  })
  const holderY = useTransform(progress, (p) => {
    if (depth === 1) return 14 - 14 * p
    if (depth === 2) return 28 - 14 * p
    return 0
  })

  // While the active card is dragged, commitment progress follows the drag.
  useEffect(() => {
    if (!active) return undefined
    const unsubscribe = x.on('change', (value) => {
      if (exitingDecision) return
      const width = cardRef.current?.offsetWidth ?? 420
      progress.set(clamp01(Math.abs(value) / commitDistanceFor(width)))
    })
    return unsubscribe
  }, [active, exitingDecision, progress, x])

  // Undo re-entry flight.
  useEffect(() => {
    if (!initialEntry || reducedMotion) return undefined
    const controlsX = animate(x, 0, { duration: RETURN_DURATION, ease: EASE })
    const controlsY = animate(y, 0, { duration: RETURN_DURATION, ease: EASE })
    const controlsP = animate(progress, 0, { duration: RETURN_DURATION, ease: EASE })
    return () => {
      controlsX.stop()
      controlsY.stop()
      controlsP.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Commit flight: when this card is marked exiting, fly it out, then report.
  useEffect(() => {
    if (!exitingDecision) return undefined
    const width = cardRef.current?.offsetWidth ?? 420
    const target = exitTargetFor(exitingDecision, width)
    const controlsP = animate(progress, 1, { duration: EXIT_DURATION, ease: EASE })
    const controlsX = animate(x, target.x, { duration: EXIT_DURATION, ease: EASE })
    let done = false
    const finish = () => {
      if (done) return
      done = true
      onExitComplete(exitingDecision)
    }
    const controlsY =
      target.y !== 0 ? animate(y, target.y, { duration: EXIT_DURATION, ease: EASE }) : null
    controlsX.then(finish, finish)
    // The decision must never depend on the animation loop actually running:
    // if requestAnimationFrame is throttled or frozen (backgrounded tab,
    // low-power mode, embedded webviews), commit on the wall clock instead.
    const fallback = setTimeout(finish, EXIT_DURATION * 1000 + 250)
    return () => {
      clearTimeout(fallback)
      controlsP.stop()
      controlsX.stop()
      controlsY?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitingDecision])

  const handleDragEnd = useCallback(
    (_event: unknown, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
      if (exitingDecision) return
      const width = cardRef.current?.offsetWidth ?? 420
      const distance = commitDistanceFor(width)
      const { offset, velocity } = info
      const horizontal = Math.abs(offset.x) >= Math.abs(offset.y)
      if (horizontal && (offset.x > distance || velocity.x > COMMIT_VELOCITY)) {
        onDragCommit('interested')
      } else if (horizontal && (offset.x < -distance || velocity.x < -COMMIT_VELOCITY)) {
        onDragCommit('passed')
      } else if (!horizontal && (offset.y < -distance || velocity.y < -COMMIT_VELOCITY)) {
        onDragDetails()
      }
      // Otherwise dragSnapToOrigin returns the card; progress follows x.
    },
    [exitingDecision, onDragCommit, onDragDetails],
  )

  return (
    <motion.div
      className="mdk-card-holder"
      style={{ scale: holderScale, y: holderY, zIndex: 20 - depth }}
      data-mdk-depth={depth}
    >
      <motion.div
        ref={cardRef}
        className={`mdk-card${active ? ' mdk-card--active' : ''}`}
        data-depth={depth}
        data-mdk-card={recommendation.recommendationId}
        style={{ x, y, rotate: reducedMotion ? 0 : rotate }}
        drag={active && !exitingDecision && !reducedMotion}
        dragSnapToOrigin
        dragElastic={0.9}
        dragMomentum={false}
        dragTransition={{ bounceStiffness: 380, bounceDamping: 34 }}
        onDragEnd={active ? handleDragEnd : undefined}
        aria-hidden={active ? undefined : true}
      >
        <MatchaDeckCard recommendation={recommendation}>
          {active ? (
            <>
              <motion.span
                className="mdk-overlay mdk-overlay--interested"
                style={{ opacity: interestedOpacity }}
                aria-hidden="true"
              >
                INTERESTED
              </motion.span>
              <motion.span
                className="mdk-overlay mdk-overlay--pass"
                style={{ opacity: passOpacity }}
                aria-hidden="true"
              >
                PASS
              </motion.span>
              <motion.span
                className="mdk-overlay mdk-overlay--details"
                style={{ opacity: detailsOpacity }}
                aria-hidden="true"
              >
                VIEW DETAILS
              </motion.span>
            </>
          ) : null}
        </MatchaDeckCard>
      </motion.div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* The deck                                                            */
/* ------------------------------------------------------------------ */

export interface MatchaDeckProps {
  source: DeckSource
  /** Receives each deck signal exactly once (persistence lands in PR J2). */
  onSignal?: (signal: DeckSignal) => void
}

type LoadPhase = 'loading' | 'ready' | 'error'

export function MatchaDeck({ source, onSignal }: MatchaDeckProps) {
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('loading')
  const [loadNonce, setLoadNonce] = useState(0)
  const [state, setState] = useState<DeckState | null>(null)
  const stateRef = useRef<DeckState | null>(null)
  const [exiting, setExiting] = useState<{ id: string; decision: DeckDecision } | null>(null)
  const restoredRef = useRef<{ id: string; decision: DeckDecision } | null>(null)
  const viewedRef = useRef<Set<string>>(new Set())
  const stageRef = useRef<HTMLDivElement>(null)
  const wasDetailsOpen = useRef(false)
  const reducedMotion = useReducedMotion() ?? false
  const progress = useMotionValue(0)

  useEffect(() => {
    let cancelled = false
    setLoadPhase('loading')
    source
      .load()
      .then((recommendations) => {
        if (cancelled) return
        const initial = createDeckState(recommendations)
        stateRef.current = initial
        setState(initial)
        setLoadPhase('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadPhase('error')
      })
    return () => {
      cancelled = true
    }
  }, [source, loadNonce])

  const dispatch = useCallback(
    (event: DeckEvent) => {
      const current = stateRef.current
      if (!current) return
      const { state: next, signals } = deckTransition(current, event)
      if (next !== current) {
        stateRef.current = next
        setState(next)
      }
      if (onSignal) {
        for (const signal of signals) onSignal(signal)
      }
    },
    [onSignal],
  )

  const active = state ? activeRecommendation(state) : null
  const activeId = active?.recommendationId ?? null

  // One viewed signal per card, exactly once.
  useEffect(() => {
    if (!activeId || viewedRef.current.has(activeId)) return
    viewedRef.current.add(activeId)
    dispatch({ type: 'card_viewed' })
  }, [activeId, dispatch])

  const commitDecision = useCallback(
    (decision: DeckDecision) => {
      const current = stateRef.current
      if (!current || exiting) return
      const rec = activeRecommendation(current)
      if (!rec) return
      const refused =
        (decision === 'interested' || decision === 'priority') && !rec.actions.canExpressInterest
      if (refused || reducedMotion) {
        // Machine handles the refusal announcement; reduced motion commits
        // instantly with no flight.
        progress.set(0)
        dispatch({ type: 'decide', decision })
        return
      }
      setExiting({ id: rec.recommendationId, decision })
    },
    [dispatch, exiting, progress, reducedMotion],
  )

  const handleExitComplete = useCallback(
    (decision: DeckDecision) => {
      progress.set(0)
      dispatch({ type: 'decide', decision })
      setExiting(null)
    },
    [dispatch, progress],
  )

  const undo = useCallback(() => {
    const current = stateRef.current
    if (!current || current.history.length === 0 || exiting) return
    const last = current.history[current.history.length - 1]
    restoredRef.current = { id: last.recommendationId, decision: last.decision }
    if (!reducedMotion) progress.set(1)
    dispatch({ type: 'undo' })
  }, [dispatch, exiting, progress, reducedMotion])

  const openDetails = useCallback(() => {
    dispatch({ type: 'open_details' })
  }, [dispatch])

  const closeDetails = useCallback(() => {
    dispatch({ type: 'close_details' })
  }, [dispatch])

  // Return focus to the stage when the sheet closes.
  const detailsOpen = Boolean(state?.detailsFor)
  useEffect(() => {
    if (wasDetailsOpen.current && !detailsOpen) {
      stageRef.current?.focus()
    }
    wasDetailsOpen.current = detailsOpen
  }, [detailsOpen])

  const handleStageKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!stateRef.current || stateRef.current.detailsFor) return
      const key = event.key
      const lower = key.toLowerCase()
      if (key === 'ArrowRight' || lower === 's') {
        event.preventDefault()
        commitDecision('interested')
      } else if (key === 'ArrowLeft' || lower === 'p') {
        event.preventDefault()
        commitDecision('passed')
      } else if (key === 'ArrowUp' || key === 'Enter') {
        event.preventDefault()
        openDetails()
      } else if (lower === 'z') {
        event.preventDefault()
        undo()
      }
    },
    [commitDecision, openDetails, undo],
  )

  const visible = useMemo(() => {
    if (!state) return []
    return state.recommendations.slice(state.cursor, state.cursor + 3)
  }, [state])

  if (loadPhase === 'loading') {
    return (
      <div className="mdk-canvas">
        <div />
        <div>
          <div className="mdk-done" role="status">
            <p>Loading opportunities…</p>
          </div>
        </div>
        <div />
      </div>
    )
  }

  if (loadPhase === 'error' || !state) {
    return (
      <div className="mdk-canvas">
        <div />
        <div>
          <div className="mdk-done" role="alert">
            <h2>The deck could not load</h2>
            <p>Nothing was decided or lost. Try again — your place is preserved.</p>
            <div className="mdk-done-actions">
              <button type="button" className="mdk-btn" onClick={() => setLoadNonce((n) => n + 1)}>
                Try again
              </button>
            </div>
          </div>
        </div>
        <div />
      </div>
    )
  }

  const exhausted = isDeckExhausted(state)
  const interested = interestedQueue(state)
  const passed = passedHistory(state)
  const position = exhausted
    ? 'Deck complete'
    : `Opportunity ${state.cursor + 1} of ${state.recommendations.length}`

  return (
    <div className="mdk-canvas" data-mdk-loaded="true">
      {/* Left rail — deck context */}
      <aside className="mdk-rail" aria-label="Deck context">
        <div className="mdk-rail-card">
          <h2>Deck</h2>
          <ul className="mdk-rail-list">
            <li>
              {position}
              <span className="mdk-rail-item-note">{source.sourceLabel}</span>
            </li>
            <li>
              {interested.length} interested · {passed.length} passed
            </li>
          </ul>
        </div>
        <div className="mdk-rail-card">
          <h2>Keyboard</h2>
          <ul className="mdk-rail-list">
            <li className="mdk-kbd-row">
              <span>Interested</span>
              <span>
                <span className="mdk-kbd">→</span> <span className="mdk-kbd">S</span>
              </span>
            </li>
            <li className="mdk-kbd-row">
              <span>Pass</span>
              <span>
                <span className="mdk-kbd">←</span> <span className="mdk-kbd">P</span>
              </span>
            </li>
            <li className="mdk-kbd-row">
              <span>Details</span>
              <span>
                <span className="mdk-kbd">↑</span> <span className="mdk-kbd">Enter</span>
              </span>
            </li>
            <li className="mdk-kbd-row">
              <span>Undo</span>
              <span className="mdk-kbd">Z</span>
            </li>
          </ul>
        </div>
      </aside>

      {/* Center — the deck stage */}
      <div>
        <div
          ref={stageRef}
          className="mdk-stage"
          role="group"
          aria-roledescription="opportunity deck"
          aria-label={state.announcement}
          aria-describedby="mdk-instructions"
          tabIndex={0}
          onKeyDown={handleStageKeyDown}
          data-mdk-cursor={state.cursor}
          data-mdk-active={activeId ?? ''}
          data-mdk-exhausted={exhausted ? 'true' : 'false'}
        >
          <p id="mdk-instructions" className="mdk-sr-only">
            Arrow right or S saves this opportunity as interested. Arrow left or P passes. Arrow up or
            Enter opens details. Z undoes your last decision. The buttons below the deck perform the same
            actions. Saving interest never submits an application.
          </p>

          {exhausted ? (
            <div className="mdk-done" data-mdk-done="true">
              <h2>You are caught up.</h2>
              <p>
                You reviewed every opportunity in this deck — {interested.length} saved as interested,{' '}
                {passed.length} passed. Nothing was shared with employers.
              </p>
              <div className="mdk-done-actions">
                <Link href="/holder/opportunities" className="mdk-btn">
                  Browse all roles
                </Link>
                <Link href="/holder/matcha/assessment" className="mdk-btn">
                  Adjust preferences
                </Link>
                {state.history.length > 0 ? (
                  <button type="button" className="mdk-btn" onClick={undo}>
                    <span className="mdk-btn-icon" aria-hidden="true">
                      ⟲
                    </span>
                    Undo last decision
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mdk-stack">
              {visible.map((rec, index) => (
                <DeckCardShell
                  key={rec.recommendationId}
                  recommendation={rec}
                  depth={index as 0 | 1 | 2}
                  progress={progress}
                  exitingDecision={exiting?.id === rec.recommendationId ? exiting.decision : null}
                  entryDecision={
                    restoredRef.current?.id === rec.recommendationId ? restoredRef.current.decision : null
                  }
                  reducedMotion={reducedMotion}
                  onDragCommit={commitDecision}
                  onDragDetails={openDetails}
                  onExitComplete={handleExitComplete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Explicit action bar — every gesture has a button */}
        <div className="mdk-actions" role="toolbar" aria-label="Deck actions">
          <button
            type="button"
            className="mdk-btn"
            onClick={undo}
            disabled={state.history.length === 0 || Boolean(exiting)}
            aria-keyshortcuts="z"
            aria-label="Undo last decision"
          >
            <span className="mdk-btn-icon" aria-hidden="true">
              ⟲
            </span>
            <span className="mdk-btn-text--hide-mobile">Undo</span>
          </button>
          <button
            type="button"
            className="mdk-btn"
            onClick={() => commitDecision('passed')}
            disabled={!active || Boolean(exiting)}
            aria-keyshortcuts="ArrowLeft p"
          >
            <span className="mdk-btn-icon" aria-hidden="true">
              ←
            </span>
            Pass
          </button>
          <button
            type="button"
            className="mdk-btn"
            onClick={openDetails}
            disabled={!active || Boolean(exiting)}
            aria-keyshortcuts="ArrowUp Enter"
          >
            Details
          </button>
          <button
            type="button"
            className="mdk-btn mdk-btn--interested"
            onClick={() => commitDecision('interested')}
            disabled={!active || Boolean(exiting) || (active ? !active.actions.canExpressInterest : false)}
            aria-keyshortcuts="ArrowRight s"
          >
            Interested
            <span className="mdk-btn-icon" aria-hidden="true">
              →
            </span>
          </button>
          <button
            type="button"
            className="mdk-btn mdk-btn--priority"
            onClick={() => commitDecision('priority')}
            disabled={!active || Boolean(exiting) || (active ? !active.actions.canExpressInterest : false)}
            aria-label="Priority — save as a top choice"
          >
            <span className="mdk-btn-icon" aria-hidden="true">
              ★
            </span>
            <span className="mdk-btn-text--hide-mobile">Priority</span>
          </button>
        </div>
      </div>

      {/* Right rail — reasoning + interested queue */}
      <aside className="mdk-rail" aria-label="Match reasoning and saved roles">
        {active ? (
          <div className="mdk-rail-card">
            <h2>Why this matches</h2>
            <ul className="mdk-rail-list">
              <li>
                {overallLabelText(active)}
                <span className="mdk-rail-item-note">{matchSummaryText(active)}</span>
              </li>
              <li>
                {active.explanation.confirmed.length} source-backed ·{' '}
                {active.explanation.preferences.length} preference
                {active.explanation.unknown.length > 0
                  ? ` · ${active.explanation.unknown.length} unknown`
                  : ''}
              </li>
            </ul>
            <p style={{ marginTop: 8 }}>Open Details to see every reason and its origin.</p>
          </div>
        ) : null}
        <div className="mdk-rail-card">
          <h2>Interested ({interested.length})</h2>
          {interested.length === 0 ? (
            <p>Roles you save land here for a calm, side-by-side look before any application.</p>
          ) : (
            <ul className="mdk-rail-list">
              {interested.map((rec) => (
                <li key={rec.recommendationId}>
                  {state.decisions[rec.recommendationId] === 'priority' ? '★ ' : ''}
                  {rec.opportunity.title}
                  <span className="mdk-rail-item-note">{rec.opportunity.employerName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Screen-reader announcements */}
      <p className="mdk-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {state.announcement}
      </p>

      {/* Details sheet — layers 2/3, preserves deck position */}
      {detailsOpen && active ? (
        <DeckDetailSheet
          recommendation={active}
          onClose={closeDetails}
          onDecide={(decision) => dispatch({ type: 'decide', decision })}
        />
      ) : null}
    </div>
  )
}
