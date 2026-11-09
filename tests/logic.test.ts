import { describe, expect, it } from 'vitest'
import { FALL_MARGIN, ROOF, SETTLE_TIME } from '../src/config'
import { difficulty, feltAt, nextEvent, type RoadEvent } from '../src/events'
import { ITEMS, verticalExtent } from '../src/items'
import { createRng } from '../src/rng'
import { isGameOver, newTrack, nextStop, trackItem } from '../src/rules'
import { createSuspension, hitBump, stepSuspension } from '../src/suspension'

const curve = (dir: -1 | 1): RoadEvent => ({ kind: 'curve', at: 0, dir, strength: 4, duration: 2, lead: 1 })

describe('road events', () => {
  it('a left curve pushes the cargo right and swings the road left', () => {
    const felt = feltAt([curve(-1)], 1)
    expect(felt.x).toBeCloseTo(4)
    expect(felt.yaw).toBeGreaterThan(0)
    expect(feltAt([curve(1)], 1).x).toBeCloseTo(-4)
  })

  it('braking throws the cargo forward, then back', () => {
    const brake: RoadEvent = { kind: 'brake', at: 0, dir: 1, strength: 5, duration: 1, lead: 0.5 }
    expect(feltAt([brake], 0.25).z).toBeLessThan(-4)
    expect(feltAt([brake], 0.75).z).toBeGreaterThan(0)
    expect(feltAt([brake], 0.5).speed).toBeLessThan(1)
  })

  it('nothing is felt outside an event', () => {
    expect(feltAt([curve(1)], -0.1)).toEqual({ x: 0, z: 0, yaw: 0, speed: 1 })
    expect(feltAt([curve(1)], 2.1).x).toBe(0)
  })

  it('events come closer together as the run goes on', () => {
    const rng = createRng(7)
    const gaps = (start: number) => {
      let total = 0
      for (let i = 0; i < 200; i++) total += nextEvent(rng, start).at - start
      return total / 200
    }
    expect(gaps(200)).toBeLessThan(gaps(0) * 0.6)
    expect(difficulty(0)).toBe(0)
    expect(difficulty(1000)).toBe(1)
  })

  it('every event is warned about before it lands', () => {
    const rng = createRng(3)
    let t = 0
    for (let i = 0; i < 100; i++) {
      const e = nextEvent(rng, t)
      expect(e.at - e.lead).toBeGreaterThan(t - 1)
      expect(e.lead).toBeGreaterThan(0)
      t = e.at
    }
  })
})

describe('suspension', () => {
  it('a bump lifts the body and it settles back', () => {
    const s = createSuspension()
    hitBump(s, 'front', 1)
    let peak = 0
    for (let i = 0; i < 30; i++) {
      stepSuspension(s, { x: 0, z: 0 }, 1 / 60)
      peak = Math.max(peak, s.heave.pos)
    }
    expect(peak).toBeGreaterThan(0.02)
    expect(peak).toBeLessThan(0.1)
    for (let i = 0; i < 240; i++) stepSuspension(s, { x: 0, z: 0 }, 1 / 60)
    expect(Math.abs(s.heave.pos)).toBeLessThan(1e-3)
    expect(Math.abs(s.pitch.pos)).toBeLessThan(1e-3)
  })

  it('leans nose-down under braking and onto the outside of a curve', () => {
    const s = createSuspension()
    for (let i = 0; i < 120; i++) stepSuspension(s, { x: 4, z: -5 }, 1 / 60)
    expect(s.pitch.pos).toBeLessThan(0)
    expect(s.roll.pos).toBeLessThan(0)
  })
})

describe('cargo rules', () => {
  it('an item resting on the roof is loaded after the settle time', () => {
    const track = newTrack()
    let change = null
    for (let t = 0; t < SETTLE_TIME + 0.05; t += 1 / 60) change = trackItem(track, { y: ROOF.topY + 0.2, speed: 0.05 }, 1 / 60) ?? change
    expect(change).toBe('loaded')
    expect(track.phase).toBe('loaded')
  })

  it('a moving item does not count', () => {
    const track = newTrack()
    for (let t = 0; t < 3; t += 1 / 60) trackItem(track, { y: ROOF.topY + 0.2, speed: 1 }, 1 / 60)
    expect(track.phase).toBe('falling')
  })

  it('an item below the roof line is lost, even after it was loaded', () => {
    const track = newTrack()
    track.phase = 'loaded'
    expect(trackItem(track, { y: ROOF.topY - FALL_MARGIN - 0.01, speed: 3 }, 1 / 60)).toBe('lost')
    expect(trackItem(track, { y: 0, speed: 0 }, 1 / 60)).toBeNull()
  })

  it('three drops end the run', () => {
    expect(isGameOver({ loaded: 5, dropped: 2, km: 10 })).toBe(false)
    expect(isGameOver({ loaded: 5, dropped: 3, km: 10 })).toBe(true)
  })

  it('names the next stop on the route', () => {
    expect(nextStop(0).name).toBe('Cikampek')
    expect(nextStop(225).name).toBe('Brebes')
    expect(nextStop(999).name).toBe('Tegal')
  })
})

describe('item extents', () => {
  const identity = { x: 0, y: 0, z: 0, w: 1 }
  const quarterTurn = (axis: 'x' | 'z') => ({ x: axis === 'x' ? Math.SQRT1_2 : 0, y: 0, z: axis === 'z' ? Math.SQRT1_2 : 0, w: Math.SQRT1_2 })

  it('matches the half height when upright', () => {
    const galon = ITEMS.find((i) => i.id === 'galon')!
    expect(verticalExtent(galon.shape, identity)).toBeCloseTo(0.24)
    const kasur = ITEMS.find((i) => i.id === 'kasur')!
    expect(verticalExtent(kasur.shape, identity)).toBeCloseTo(0.2)
  })

  it('follows the item when it tips over', () => {
    const kardus = ITEMS.find((i) => i.id === 'kardus')!
    // Rolled 90° about z, the box stands on its end: x extent becomes vertical.
    expect(verticalExtent(kardus.shape, quarterTurn('z'))).toBeCloseTo(0.27)
    const galon = ITEMS.find((i) => i.id === 'galon')!
    expect(verticalExtent(galon.shape, quarterTurn('x'))).toBeCloseTo(0.14)
  })
})
