import { range, pickWeighted, type Rng } from './rng'

// Things the road throws at the car. A bump or pothole is a scenery object
// that reaches the wheels at `at`; a curve or a hard brake is felt by the
// cargo as an inertial push from `at` for `duration` seconds.

export type RoadEventKind = 'bump' | 'pothole' | 'curve' | 'brake'

export interface RoadEvent {
  kind: RoadEventKind
  /** Run time at which the effect reaches the car. */
  at: number
  /** Curve: -1 turns left, +1 turns right. Pothole: side of the car it hits. */
  dir: -1 | 1
  strength: number
  duration: number
  /** Warning shown this many seconds before `at`. */
  lead: number
}

export interface Felt {
  /** Inertial acceleration on the cargo, m/s². +x pushes right, +z pushes backward. */
  x: number
  z: number
  /** Scenery yaw that sells a bend in the road, radians. */
  yaw: number
  /** Road scroll speed multiplier. */
  speed: number
}

/** 0 at the start of a run, easing up to 1 after `RAMP` seconds. */
const RAMP = 150

export function difficulty(t: number): number {
  const u = Math.min(1, Math.max(0, t / RAMP))
  return u * u * (3 - 2 * u)
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u

export const LEAD: Record<RoadEventKind, number> = { bump: 2.4, pothole: 2.0, curve: 1.5, brake: 0.75 }

/** The first event comes after this many seconds, so the first item can land. */
export const FIRST_EVENT_AT = 6

export function nextEvent(rng: Rng, after: number): RoadEvent {
  const d = difficulty(after)
  const gap = lerp(5.5, 2.4, d) * range(rng, 0.8, 1.2)
  const at = after + gap
  const kind = pickWeighted(rng, [
    { kind: 'bump' as const, weight: 3 },
    { kind: 'curve' as const, weight: 2.5 },
    { kind: 'brake' as const, weight: lerp(0.6, 1.6, d) },
    { kind: 'pothole' as const, weight: lerp(0.4, 1.4, d) },
  ]).kind
  const dir: -1 | 1 = rng() < 0.5 ? -1 : 1
  const jitter = range(rng, 0.85, 1.15)
  switch (kind) {
    case 'bump':
      return { kind, at, dir, strength: lerp(0.9, 1.5, d) * jitter, duration: 0, lead: LEAD.bump }
    case 'pothole':
      return { kind, at, dir, strength: lerp(0.5, 0.95, d) * jitter, duration: 0, lead: LEAD.pothole }
    case 'curve':
      return { kind, at, dir, strength: lerp(2.6, 5.2, d) * jitter, duration: range(rng, 2.6, 3.4), lead: LEAD.curve }
    case 'brake':
      return { kind, at, dir, strength: lerp(3.5, 6.5, d) * jitter, duration: 1.1, lead: LEAD.brake }
  }
}

const CURVE_YAW = 0.2

/** Sum of the inertial effects of every curve and brake running at time `t`. */
export function feltAt(events: readonly RoadEvent[], t: number): Felt {
  const felt: Felt = { x: 0, z: 0, yaw: 0, speed: 1 }
  for (const e of events) {
    if (e.duration <= 0) continue
    const u = (t - e.at) / e.duration
    if (u < 0 || u > 1) continue
    if (e.kind === 'curve') {
      const env = Math.sin(Math.PI * u)
      // Turning left pushes the cargo right, and the road ahead swings left.
      felt.x += -e.dir * e.strength * env
      felt.yaw += -e.dir * CURVE_YAW * env
    } else if (e.kind === 'brake') {
      // Hard deceleration first (cargo lurches forward), then the driver
      // gets back on the gas (a gentler push backward).
      felt.z += u < 0.5 ? -e.strength * Math.sin(2 * Math.PI * u) : 0.35 * e.strength * Math.sin(2 * Math.PI * (u - 0.5))
      felt.speed -= 0.45 * Math.sin(Math.PI * u)
    }
  }
  return felt
}

export function isOver(e: RoadEvent, t: number): boolean {
  return t > e.at + e.duration + 0.5
}
