// The cargo catalogue. Shapes are in body coordinates: boxes by half extents,
// cylinders upright along y unless `lying` (then the axis runs along x).

export type ItemShape =
  | { type: 'box'; half: readonly [number, number, number] }
  | { type: 'cylinder'; radius: number; halfHeight: number; lying: boolean }
  | { type: 'ball'; radius: number }

export interface ItemKind {
  id: string
  name: string
  mass: number
  friction: number
  shape: ItemShape
  /** Relative spawn frequency. */
  weight: number
  angularDamping?: number
  restitution?: number
}

export const ITEMS: readonly ItemKind[] = [
  { id: 'kardus', name: 'Kardus Mi', mass: 6, friction: 0.8, weight: 3, shape: { type: 'box', half: [0.27, 0.16, 0.19] } },
  { id: 'koper', name: 'Koper', mass: 9, friction: 0.6, weight: 2, shape: { type: 'box', half: [0.31, 0.13, 0.21] } },
  { id: 'karung', name: 'Karung Beras', mass: 20, friction: 1.0, weight: 2, shape: { type: 'box', half: [0.25, 0.12, 0.36] } },
  { id: 'galon', name: 'Galon', mass: 19, friction: 0.5, weight: 1.5, shape: { type: 'cylinder', radius: 0.14, halfHeight: 0.24, lying: false } },
  { id: 'kasur', name: 'Kasur Gulung', mass: 7, friction: 0.9, weight: 1.5, shape: { type: 'cylinder', radius: 0.2, halfHeight: 0.62, lying: true } },
  { id: 'kandang', name: 'Kandang Ayam', mass: 4, friction: 0.7, weight: 1.4, restitution: 0.15, shape: { type: 'box', half: [0.3, 0.22, 0.22] } },
  { id: 'tv', name: 'TV Tabung', mass: 14, friction: 0.7, weight: 0.8, shape: { type: 'box', half: [0.26, 0.22, 0.24] } },
  { id: 'tikar', name: 'Tikar', mass: 2, friction: 0.8, weight: 1, shape: { type: 'cylinder', radius: 0.08, halfHeight: 0.55, lying: true } },
  { id: 'durian', name: 'Durian', mass: 2.5, friction: 1.0, weight: 0.6, angularDamping: 3, shape: { type: 'ball', radius: 0.17 } },
]

/** Half of the item's vertical extent when it sits as spawned. */
export function halfHeight(shape: ItemShape): number {
  switch (shape.type) {
    case 'box':
      return shape.half[1]
    case 'cylinder':
      return shape.lying ? shape.radius : shape.halfHeight
    case 'ball':
      return shape.radius
  }
}

/**
 * How far the item reaches above its centre in orientation `q`. Uses the
 * second row of the rotation matrix: a body-frame vector v rises by r1·v.
 */
export function verticalExtent(shape: ItemShape, q: { x: number; y: number; z: number; w: number }): number {
  const { x, y, z, w } = q
  const r10 = 2 * (x * y + w * z)
  const r11 = 1 - 2 * (x * x + z * z)
  const r12 = 2 * (y * z - w * x)
  switch (shape.type) {
    case 'box': {
      const [hx, hy, hz] = shape.half
      return Math.abs(r10) * hx + Math.abs(r11) * hy + Math.abs(r12) * hz
    }
    case 'cylinder': {
      const ay = shape.lying ? r10 : r11
      return Math.abs(ay) * shape.halfHeight + Math.sqrt(Math.max(0, 1 - ay * ay)) * shape.radius
    }
    case 'ball':
      return shape.radius
  }
}

/** Radius of a sphere that contains the item in any orientation. */
export function boundRadius(shape: ItemShape): number {
  switch (shape.type) {
    case 'box':
      return Math.hypot(...shape.half)
    case 'cylinder':
      return Math.hypot(shape.radius, shape.halfHeight)
    case 'ball':
      return shape.radius
  }
}
