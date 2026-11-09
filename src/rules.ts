import { FALL_MARGIN, MAX_DROPS, ROOF, SETTLE_SPEED, SETTLE_TIME } from './config'

export type ItemPhase = 'falling' | 'loaded' | 'lost'

export interface ItemTrack {
  phase: ItemPhase
  restTime: number
}

export type ItemChange = 'loaded' | 'lost' | null

export function newTrack(): ItemTrack {
  return { phase: 'falling', restTime: 0 }
}

/**
 * Advances one dropped item. It is lost once its centre is clearly below the
 * roof (on the hood, the road, anywhere off the rack), and loaded once it has
 * rested on the stack for SETTLE_TIME. A loaded item can still be lost later.
 */
export function trackItem(track: ItemTrack, sample: { y: number; speed: number }, dt: number): ItemChange {
  if (track.phase === 'lost') return null
  if (sample.y < ROOF.topY - FALL_MARGIN) {
    track.phase = 'lost'
    return 'lost'
  }
  if (track.phase === 'falling') {
    if (sample.speed < SETTLE_SPEED) track.restTime += dt
    else if (sample.speed > 2 * SETTLE_SPEED) track.restTime = 0
    if (track.restTime >= SETTLE_TIME) {
      track.phase = 'loaded'
      return 'loaded'
    }
  }
  return null
}

export interface RunStats {
  loaded: number
  dropped: number
  km: number
}

export function isGameOver(stats: RunStats): boolean {
  return stats.dropped >= MAX_DROPS
}

export interface Stop {
  name: string
  km: number
}

/** Pantura, Jakarta to Tegal. The last stop is the destination. */
export const STOPS: readonly Stop[] = [
  { name: 'Cikampek', km: 70 },
  { name: 'Subang', km: 130 },
  { name: 'Cirebon', km: 220 },
  { name: 'Brebes', km: 285 },
  { name: 'Tegal', km: 330 },
]

export function nextStop(km: number): Stop {
  return STOPS.find((s) => s.km > km) ?? STOPS[STOPS.length - 1]!
}

/** Road kilometres covered per second of play at cruising speed. */
export const KM_PER_SECOND = 0.75
