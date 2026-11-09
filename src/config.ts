// All distances in metres, times in seconds. The physics runs in the car's
// frame: the car stays at the origin facing -z and the road scrolls past it,
// so braking and cornering reach the cargo as inertial forces (see events.ts).

export const PHYSICS_DT = 1 / 60
export const GRAVITY = -9.81

/** Cruising speed of the road scroll, ~58 km/h. */
export const ROAD_SPEED = 16

/** Height of the suspension pivot the body pitches and rolls around. */
export const PIVOT_Y = 0.55

/**
 * Roof rack basket, in body coordinates relative to the road at rest. Sized to
 * the Avanza model: its roof is flat at ~1.63 m from z -0.25 to 1.5, and the
 * basket stands on feet a little above it, overhanging the edges like the
 * big mudik racks do.
 */
export const ROOF = {
  centerZ: 0.65,
  halfX: 0.72,
  halfZ: 1.0,
  /** Top surface of the plate at rest. Items resting above this count as loaded. */
  topY: 1.76,
}

export const AXLE_Z = { front: -1.327, rear: 1.328 }
export const WHEEL_RADIUS = 0.31

/** An item whose centre drops this far below the roof top has fallen off. */
export const FALL_MARGIN = 0.45
export const MAX_DROPS = 3

/** How long an item must sit still on the stack before it counts as loaded. */
export const SETTLE_TIME = 1.2
export const SETTLE_SPEED = 0.25

/** The next item hovers this far above the stack top. */
export const HOVER_GAP = 0.6
/** Seconds the player gets to aim before the item drops by itself. */
export const HOVER_TIME = 4.5
export const HOVER_RANGE = { x: 0.9, z: 1.15 }
