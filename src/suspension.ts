// Spring-damper model of the car body on its suspension. The physics world
// reads heave/pitch/roll from here and moves the kinematic car body to match,
// so the cargo feels every bump through real contacts.

export interface Axis {
  pos: number
  vel: number
}

export interface Suspension {
  /** Vertical offset of the body, metres. */
  heave: Axis
  /** Rotation about x, radians. Positive lifts the nose (-z). */
  pitch: Axis
  /** Rotation about z, radians. Negative lowers the right (+x) side. */
  roll: Axis
}

const STIFFNESS = { heave: 170, pitch: 130, roll: 120 }
const DAMPING = { heave: 11, pitch: 9, roll: 9 }

/** Body lean per m/s² of felt acceleration, radians. */
export const LEAN_PER_ACCEL = 0.012

export function createSuspension(): Suspension {
  return { heave: { pos: 0, vel: 0 }, pitch: { pos: 0, vel: 0 }, roll: { pos: 0, vel: 0 } }
}

function stepAxis(axis: Axis, target: number, k: number, c: number, dt: number): void {
  const acc = -k * (axis.pos - target) - c * axis.vel
  axis.vel += acc * dt
  axis.pos += axis.vel * dt
}

/**
 * Advances the body. `felt` is the inertial acceleration the cargo feels
 * (x: pushed right, z: pushed backward); the body leans with it, nose down
 * under braking and onto the outside of a corner.
 */
export function stepSuspension(s: Suspension, felt: { x: number; z: number }, dt: number): void {
  stepAxis(s.heave, 0, STIFFNESS.heave, DAMPING.heave, dt)
  stepAxis(s.pitch, LEAN_PER_ACCEL * felt.z, STIFFNESS.pitch, DAMPING.pitch, dt)
  stepAxis(s.roll, -LEAN_PER_ACCEL * felt.x, STIFFNESS.roll, DAMPING.roll, dt)
}

export type Axle = 'front' | 'rear'

/** A wheel pair rolling over a speed bump: lifts the body and pitches it. */
export function hitBump(s: Suspension, axle: Axle, strength: number): void {
  s.heave.vel += 0.8 * strength
  s.pitch.vel += (axle === 'front' ? 1 : -1) * 0.6 * strength
}

/** One wheel dropping into a pothole: a sharp roll toward that side. */
export function hitPothole(s: Suspension, side: -1 | 1, strength: number): void {
  s.heave.vel -= 0.3 * strength
  s.roll.vel += -side * 0.9 * strength
}
