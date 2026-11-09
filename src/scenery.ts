import * as THREE from 'three'
import { canvasTexture, centeredText, speckle } from './textures'

// The Pantura on a treadmill. The car sits at x = 0 in the left lane
// (Indonesia drives on the left); everything here scrolls toward +z.

const LANE = 3.6
export const ROAD_CENTER_X = LANE / 2
const ROAD_HALF = LANE
const FAR_Z = -260
const NEAR_Z = 30
const SPAN = NEAR_Z - FAR_Z
const ROAD_LEN = SPAN + 40
const DASH_TILE = 8

interface Prop {
  obj: THREE.Object3D
}

export interface Obstacle {
  mesh: THREE.Object3D
  /** Called with the obstacle's z after it moves; return true to remove it. */
  onMove: (z: number) => boolean
}

const std = (params: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...params })

function roadTexture(): THREE.Texture {
  const tex = canvasTexture('jalan', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#4a4c50'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 5000, 0.18)
    const px = (x: number) => ((x + ROAD_HALF) / (ROAD_HALF * 2)) * w
    ctx.fillStyle = '#ecebe4'
    ctx.fillRect(px(-ROAD_HALF + 0.2), 0, 10, h)
    ctx.fillRect(px(ROAD_HALF - 0.2) - 10, 0, 10, h)
    // Centre line: 3 m dash, 5 m gap.
    ctx.fillRect(px(0) - 6, 0, 12, (3 / DASH_TILE) * h)
  })
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, ROAD_LEN / DASH_TILE)
  return tex
}

function fieldTexture(): THREE.Texture {
  const tex = canvasTexture('sawah', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6fa63a'
    ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 8) {
      ctx.fillStyle = y % 16 ? 'rgba(40, 90, 20, 0.22)' : 'rgba(170, 210, 90, 0.18)'
      ctx.fillRect(0, y, w, 4)
    }
    ctx.fillStyle = 'rgba(120, 95, 50, 0.55)'
    ctx.fillRect(0, 0, w, 5)
    ctx.fillRect(0, 0, 5, h)
    speckle(ctx, w, h, 1500, 0.1)
  })
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(30, ROAD_LEN / 12)
  return tex
}

function coconutTree(): THREE.Group {
  const g = new THREE.Group()
  const height = 6 + Math.random() * 4
  const lean = (Math.random() - 0.5) * 0.25
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, height, 7), std({ color: '#8a6d4b' }))
  trunk.position.y = height / 2
  trunk.rotation.z = lean
  trunk.castShadow = true
  g.add(trunk)
  const top = new THREE.Vector3(-Math.sin(lean) * height, height, 0)
  const leaf = std({ color: '#3f8a2c', side: THREE.DoubleSide })
  for (let i = 0; i < 8; i++) {
    const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 3.2), leaf)
    frond.position.copy(top)
    frond.rotation.set(-1.0 - Math.random() * 0.4, (i / 8) * Math.PI * 2, 0, 'YXZ')
    frond.translateY(1.4)
    g.add(frond)
  }
  return g
}

function house(): THREE.Group {
  const g = new THREE.Group()
  const walls = ['#f1e3c6', '#dfe9e1', '#f5d0a9', '#e8e2f0']
  const w = 6 + Math.random() * 3
  const d = 5 + Math.random() * 2
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), std({ color: walls[Math.floor(Math.random() * walls.length)] }))
  body.position.y = 1.5
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.4, 2.2, 4), std({ color: '#b5502c' }))
  roof.rotation.y = Math.PI / 4
  roof.scale.set(w / Math.hypot(w, d), 1, d / Math.hypot(w, d))
  roof.position.y = 4.1
  body.castShadow = roof.castShadow = true
  g.add(body, roof)
  return g
}

function warteg(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 5), std({ color: '#fdf7e2' }))
  body.position.y = 1.6
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 1.8, 4), std({ color: '#1b5e20' }))
  roof.rotation.y = Math.PI / 4
  roof.scale.set(7 / 7.8, 1, 5 / 7.8)
  roof.position.y = 4.1
  const tex = canvasTexture('warteg-banner', 256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffeb3b'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#c62828'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, w - 4, h - 4)
    centeredText(ctx, 'WARTEG BAHARI', w / 2, h / 2 - 5, 24, '#c62828', 800)
    centeredText(ctx, 'SEDIA NASI LENGKO & ES TEH', w / 2, h / 2 + 16, 12, '#1b5e20', 700)
  })
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.3), std({ map: tex }))
  banner.position.set(0, 2.1, 2.52)
  body.castShadow = roof.castShadow = true
  g.add(body, roof, banner)
  return g
}

function billboard(text: string, sub: string, bg: string): THREE.Group {
  const g = new THREE.Group()
  const tex = canvasTexture(`bb-${text}`, 512, 256, (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 10
    ctx.strokeRect(10, 10, w - 20, h - 20)
    centeredText(ctx, text, w / 2, h / 2 - 22, 72, '#fff')
    centeredText(ctx, sub, w / 2, h / 2 + 52, 34, '#fff3c4', 600)
  })
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), std({ map: tex, side: THREE.DoubleSide }))
  board.position.y = 5
  board.rotation.y = 0.5
  g.add(board)
  for (const x of [-2.2, 2.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4, 6), std({ color: '#666' }))
    post.position.set(x * Math.cos(0.5), 2, -x * Math.sin(0.5))
    g.add(post)
  }
  return g
}

function powerPole(): THREE.Group {
  const g = new THREE.Group()
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 9, 6), std({ color: '#9a9a96' }))
  pole.position.y = 4.5
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), std({ color: '#555' }))
  arm.position.y = 8.4
  pole.castShadow = true
  g.add(pole, arm)
  return g
}

function speedBump(): THREE.Mesh {
  const tex = canvasTexture('polisi-tidur', 256, 32, (ctx, w, h) => {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? '#141414' : '#f2c21b'
      ctx.fillRect((i * w) / 16, 0, w / 16, h)
    }
  })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2, 0.08, 0.5), std({ map: tex }))
  mesh.position.set(ROAD_CENTER_X, 0.04, 0)
  mesh.receiveShadow = true
  return mesh
}

function pothole(): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), std({ color: '#26272a', roughness: 1 }))
  mesh.rotation.x = -Math.PI / 2
  mesh.scale.set(1, 0.7, 1)
  return mesh
}

export class Scenery {
  /** Everything that bends with the road. */
  readonly group = new THREE.Group()
  private readonly road: THREE.Texture
  private readonly field: THREE.Texture
  private readonly props: Prop[] = []
  private readonly obstacles: Obstacle[] = []
  private readonly traffic: THREE.Object3D[] = []
  private trafficTimer = 3

  /** `traffic`: vehicle models facing +z, cloned for the oncoming lane. */
  constructor(
    scene: THREE.Scene,
    private readonly trafficModels: readonly THREE.Object3D[],
  ) {
    scene.add(this.group)
    this.road = roadTexture()
    this.field = fieldTexture()

    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, ROAD_LEN), std({ map: this.road, roughness: 0.92 }))
    road.rotation.x = -Math.PI / 2
    road.position.set(ROAD_CENTER_X, 0.01, FAR_Z + ROAD_LEN / 2 - 20)
    road.receiveShadow = true

    const shoulder = std({ color: '#a38b62' })
    for (const side of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, ROAD_LEN), shoulder)
      s.rotation.x = -Math.PI / 2
      s.position.set(ROAD_CENTER_X + side * (ROAD_HALF + 1.2), 0.005, road.position.z)
      s.receiveShadow = true
      this.group.add(s)
    }

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, ROAD_LEN), std({ map: this.field }))
    ground.rotation.x = -Math.PI / 2
    ground.position.set(0, 0, road.position.z)
    ground.receiveShadow = true
    this.group.add(road, ground)

    this.scatter(coconutTree, 16, () => (Math.random() < 0.5 ? -7 - Math.random() * 6 : 10 + Math.random() * 10))
    this.scatter(house, 4, () => (Math.random() < 0.5 ? -16 - Math.random() * 10 : 20 + Math.random() * 12))
    this.scatter(warteg, 3, () => (Math.random() < 0.5 ? -14 - Math.random() * 6 : 16 + Math.random() * 8))
    this.scatter(powerPole, 7, () => -4.6, true)
    this.scatter(() => billboard('SELAMAT MUDIK', 'Hati-hati di jalan, ya!', '#1f7a4d'), 1, () => -9)
    this.scatter(() => billboard('POSKO MUDIK', 'Istirahat dulu 500 m', '#c0392b'), 1, () => 12)

    const mountains = new THREE.Group()
    const hill = std({ color: '#7d9db5', roughness: 1, flatShading: true })
    for (let i = 0; i < 9; i++) {
      const h = 40 + Math.random() * 60
      const m = new THREE.Mesh(new THREE.ConeGeometry(70 + Math.random() * 60, h, 6), hill)
      m.position.set(-280 + i * 70 + Math.random() * 30, h / 2 - 4, -340 - Math.random() * 60)
      mountains.add(m)
    }
    scene.add(mountains)
  }

  private scatter(make: () => THREE.Object3D, count: number, x: () => number, even = false): void {
    for (let i = 0; i < count; i++) {
      const obj = make()
      const z = even ? FAR_Z + (i / count) * SPAN : FAR_Z + Math.random() * SPAN
      obj.position.set(x(), 0, z)
      obj.rotation.y += Math.random() * 0.3
      this.group.add(obj)
      this.props.push({ obj })
    }
  }

  /** Puts an obstacle on the road `distance` metres ahead of the car's origin. */
  addObstacle(kind: 'bump' | 'pothole', distance: number, side: -1 | 1, onMove: (z: number) => boolean): void {
    const mesh = kind === 'bump' ? speedBump() : pothole()
    if (kind === 'pothole') mesh.position.set(side * 0.78, 0.015, 0)
    mesh.position.z = -distance
    this.group.add(mesh)
    this.obstacles.push({ mesh, onMove })
  }

  /** Hands an object to the road (a fallen item) so it slides away behind the car. */
  carry(obj: THREE.Object3D): void {
    this.group.attach(obj)
    this.obstacles.push({ mesh: obj, onMove: () => false })
  }

  update(dt: number, speed: number, yaw: number): void {
    this.group.rotation.y = yaw
    const dz = speed * dt
    this.road.offset.y = (this.road.offset.y + dz / DASH_TILE) % 1
    this.field.offset.y = (this.field.offset.y + dz / 12) % 1

    for (const p of this.props) {
      p.obj.position.z += dz
      if (p.obj.position.z > NEAR_Z) p.obj.position.z -= SPAN
    }
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i]!
      o.mesh.position.z += dz
      if (o.onMove(o.mesh.position.z) || o.mesh.position.z > NEAR_Z) {
        this.group.remove(o.mesh)
        this.obstacles.splice(i, 1)
      }
    }

    // Oncoming trucks and vans in the right lane.
    this.trafficTimer -= dt
    if (this.trafficTimer <= 0) {
      this.trafficTimer = 5 + Math.random() * 7
      const model = this.trafficModels[Math.floor(Math.random() * this.trafficModels.length)]
      if (!model) return
      const b = model.clone(true)
      b.position.set(ROAD_CENTER_X + LANE / 2, 0, FAR_Z)
      this.group.add(b)
      this.traffic.push(b)
    }
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const b = this.traffic[i]!
      b.position.z += dz + 15 * dt
      if (b.position.z > NEAR_Z + 10) {
        this.group.remove(b)
        this.traffic.splice(i, 1)
      }
    }
  }

  clearObstacles(): void {
    for (const o of this.obstacles) this.group.remove(o.mesh)
    this.obstacles.length = 0
  }
}
