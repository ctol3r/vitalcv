import { describe, expect, it } from 'vitest'

import {
  COMMIT_VELOCITY,
  commitDistanceFor,
  resolveDragIntent,
} from '../components/matcha-deck/dragIntent'

const STILL = { x: 0, y: 0 }
const WIDE = 460 // desktop card
const NARROW = 340 // mobile card

describe('MATCHA deck — commit distance', () => {
  it('scales with the card width so the gesture feels the same at any size', () => {
    expect(commitDistanceFor(NARROW)).toBeCloseTo(95.2)
  })

  it('caps on wide cards so a desktop drag never has to be huge', () => {
    expect(commitDistanceFor(WIDE)).toBe(120)
    expect(commitDistanceFor(2000)).toBe(120)
  })
})

describe('MATCHA deck — drag intent by distance', () => {
  it('commits interested past the right threshold', () => {
    expect(resolveDragIntent({ x: 121, y: 0 }, STILL, WIDE)).toBe('interested')
  })

  it('commits pass past the left threshold', () => {
    expect(resolveDragIntent({ x: -121, y: 0 }, STILL, WIDE)).toBe('passed')
  })

  it('opens details past the upward threshold', () => {
    expect(resolveDragIntent({ x: 0, y: -121 }, STILL, WIDE)).toBe('details')
  })

  it('returns the card below the threshold in every direction', () => {
    expect(resolveDragIntent({ x: 119, y: 0 }, STILL, WIDE)).toBeNull()
    expect(resolveDragIntent({ x: -119, y: 0 }, STILL, WIDE)).toBeNull()
    expect(resolveDragIntent({ x: 0, y: -119 }, STILL, WIDE)).toBeNull()
  })

  it('exactly at the threshold does not commit — it must be passed, not met', () => {
    expect(resolveDragIntent({ x: 120, y: 0 }, STILL, WIDE)).toBeNull()
  })

  it('never commits downward — there is no downward action', () => {
    expect(resolveDragIntent({ x: 0, y: 300 }, STILL, WIDE)).toBeNull()
    expect(resolveDragIntent({ x: 0, y: 0 }, { x: 0, y: 5000 }, WIDE)).toBeNull()
  })
})

describe('MATCHA deck — drag intent by velocity', () => {
  it('a fast flick commits even when the drag never passed the distance', () => {
    expect(resolveDragIntent({ x: 40, y: 0 }, { x: COMMIT_VELOCITY + 1, y: 0 }, WIDE)).toBe('interested')
    expect(resolveDragIntent({ x: -40, y: 0 }, { x: -(COMMIT_VELOCITY + 1), y: 0 }, WIDE)).toBe('passed')
  })

  it('a fast upward flick opens details', () => {
    expect(resolveDragIntent({ x: 0, y: -40 }, { x: 0, y: -(COMMIT_VELOCITY + 1) }, WIDE)).toBe('details')
  })

  it('exactly at the velocity threshold does not commit', () => {
    expect(resolveDragIntent({ x: 40, y: 0 }, { x: COMMIT_VELOCITY, y: 0 }, WIDE)).toBeNull()
  })

  it('a slow short drag decides nothing', () => {
    expect(resolveDragIntent({ x: 40, y: 0 }, { x: 200, y: 0 }, WIDE)).toBeNull()
  })

  it('velocity opposing a past-threshold distance still commits on distance', () => {
    // The clinician dragged deliberately far, then eased off before releasing.
    expect(resolveDragIntent({ x: 200, y: 0 }, { x: -50, y: 0 }, WIDE)).toBe('interested')
  })
})

describe('MATCHA deck — dominant axis', () => {
  it('a mostly-horizontal diagonal is a horizontal decision', () => {
    expect(resolveDragIntent({ x: 130, y: -60 }, STILL, WIDE)).toBe('interested')
  })

  it('a mostly-vertical diagonal opens details', () => {
    expect(resolveDragIntent({ x: 60, y: -130 }, STILL, WIDE)).toBe('details')
  })

  it('a perfect diagonal tie resolves horizontally — the primary decision axis', () => {
    expect(resolveDragIntent({ x: 130, y: -130 }, STILL, WIDE)).toBe('interested')
  })
})
