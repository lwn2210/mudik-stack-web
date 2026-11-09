import type * as RAPIER from '@dimforge/rapier3d'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { CarModel } from './carModel'
import { CargoWorld } from './cargoWorld'
import type { Assets } from './assets'
import { Sfx } from './audio'
import { AXLE_Z, HOVER_GAP, HOVER_RANGE, HOVER_TIME, MAX_DROPS, PHYSICS_DT, ROAD_SPEED, ROOF, WHEEL_RADIUS } from './config'
import { difficulty, feltAt, FIRST_EVENT_AT, isOver, nextEvent, type Felt, type RoadEvent } from './events'
import { Hud } from './hud'
import { buildItemMesh } from './itemMeshes'
import { ITEMS, verticalExtent, type ItemKind } from './items'
import { createRng, pickWeighted, type Rng } from './rng'
import { isGameOver, KM_PER_SECOND, newTrack, STOPS, trackItem, type ItemTrack, type RunStats } from './rules'
import { Scenery } from './scenery'
import { createSuspension, hitBump, hitPothole, stepSuspension, type Suspension } from './suspension'

interface Cargo {
  kind: ItemKind
  body: RAPIER.RigidBody
  mesh: THREE.Object3D
  track: ItemTrack
  /** Vertical speed last step, to hear it land. */
  lastVy: number
}

interface Debris {
  mesh: THREE.Object3D
  vel: THREE.Vector3
  spin: THREE.Vector3
}

interface Hover {
  kind: ItemKind
  mesh: THREE.Object3D
  rot: THREE.Quaternion
  axis: 'x' | 'z'
  phase: number
  offset: number
  age: number
  limit: number
}

type Phase = 'menu' | 'playing' | 'over'

const BEST_KEY = 'mudik-stack.best'
const ARRIVAL_KM = STOPS[STOPS.length - 1]!.km
const lerp = (a: number, b: number, u: number) => a + (b - a) * u
const tri = (p: number) => 2 * Math.abs((((p % 2) + 2) % 2) - 1) - 1

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

function writeBest(value: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(value))
  } catch {
    // Private mode or blocked storage: the record just isn't kept.
  }
}

function skyDome(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color('#4f9be0') }, bottom: { value: new THREE.Color('#d7ecf6') } },
    vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 bottom; varying vec3 vPos; void main() { float h = clamp(normalize(vPos).y * 2.2, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
  })
  return new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), material)
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 900)
  private readonly car: CarModel
  private readonly scenery: Scenery
  private readonly hud = new Hud()
  private readonly sfx = new Sfx()
  private readonly marker: THREE.Mesh
  private readonly dropLine: THREE.Line
  private cargo = new CargoWorld()

  private phase: Phase = 'menu'
  private rng: Rng = createRng(1)
  private susp: Suspension = createSuspension()
  private time = 0
  private pending: RoadEvent | null = null
  private active: RoadEvent[] = []
  private felt: Felt = { x: 0, z: 0, yaw: 0, speed: 1 }
  private items: Cargo[] = []
  private debris: Debris[] = []
  private hover: Hover | null = null
  private spawnDelay = 0
  private nextAxis: 'x' | 'z' = 'x'
  private stats: RunStats = { loaded: 0, dropped: 0, km: 0 }
  private best = readBest()
  private stackTop = ROOF.topY
  private focusY = 2
  private accumulator = 0
  private last = performance.now()
  private overTimer = -1
  private arrived = false

  constructor(canvas: HTMLCanvasElement, assets: Assets) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    this.scene.fog = new THREE.Fog('#d7ecf6', 70, 300)
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.55
    this.scene.add(skyDome())
    this.scene.add(new THREE.HemisphereLight('#cfe8ff', '#6c8a3a', 1.1))
    const sun = new THREE.DirectionalLight('#fff4dc', 2.4)
    sun.position.set(-6, 12, 4)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 })
    sun.shadow.bias = -0.0005
    this.scene.add(sun, sun.target)

    this.scenery = new Scenery(this.scene, assets.traffic)
    this.car = new CarModel(assets.car)
    this.scene.add(this.car.root)

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.16, 24),
      new THREE.MeshBasicMaterial({ color: '#2f9e5b', transparent: true, opacity: 0.85, depthTest: false }),
    )
    this.marker.rotation.x = -Math.PI / 2
    this.marker.renderOrder = 10
    this.marker.visible = false
    this.scene.add(this.marker)
    // Plumb line from the hovering item to where it would land: depth is hard to read otherwise.
    this.dropLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthTest: false }),
    )
    this.dropLine.renderOrder = 10
    this.dropLine.visible = false
    this.scene.add(this.dropLine)

    this.hud.onStart(() => this.start())
    this.hud.showMenu(this.best)
    this.bindInput(canvas)
    window.addEventListener('resize', () => this.resize())
    this.resize()
    this.renderer.setAnimationLoop(() => this.frame())
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', () => this.drop())
    const mute = document.getElementById('mute')!
    const showMute = () => (mute.textContent = this.sfx.muted ? '🔇' : '🔊')
    showMute()
    mute.addEventListener('click', () => {
      this.sfx.toggleMute()
      showMute()
    })
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        this.sfx.toggleMute()
        showMute()
        return
      }
      if (e.code !== 'Space' && e.code !== 'Enter') return
      e.preventDefault()
      if (e.repeat) return
      if (this.phase === 'playing') this.drop()
      else if (this.overTimer < 0) this.start()
    })
  }

  private resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.fov = w / h < 1 ? 62 : 45
    this.camera.updateProjectionMatrix()
  }

  start(): void {
    this.reset()
    this.phase = 'playing'
    this.hud.showPlaying()
    this.hud.setScore(0, 0)
    this.hud.setRoute(0)
    this.spawnDelay = 0.4
  }

  private reset(): void {
    for (const item of this.items) this.scene.remove(item.mesh)
    for (const d of this.debris) d.mesh.removeFromParent()
    if (this.hover) this.scene.remove(this.hover.mesh)
    this.cargo.dispose()
    this.cargo = new CargoWorld()
    this.scenery.clearObstacles()
    this.items = []
    this.debris = []
    this.hover = null
    this.rng = createRng((Math.random() * 2 ** 32) >>> 0)
    this.susp = createSuspension()
    this.time = 0
    this.pending = nextEvent(this.rng, FIRST_EVENT_AT - 4)
    this.active = []
    this.stats = { loaded: 0, dropped: 0, km: 0 }
    this.stackTop = ROOF.topY
    this.overTimer = -1
  }

  private frame(): void {
    const now = performance.now()
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    this.accumulator += dt
    while (this.accumulator >= PHYSICS_DT) {
      this.fixedStep()
      this.accumulator -= PHYSICS_DT
    }
    this.syncVisuals(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private fixedStep(): void {
    const dt = PHYSICS_DT
    if (this.phase === 'menu') {
      // Attract mode: the car just cruises.
      this.scenery.update(dt, ROAD_SPEED, 0)
      stepSuspension(this.susp, { x: 0, z: 0 }, dt)
      return
    }
    this.time += dt
    this.scheduleEvents()
    this.felt = feltAt(this.active, this.time)
    this.active = this.active.filter((e) => !isOver(e, this.time))
    const speed = ROAD_SPEED * this.felt.speed

    this.scenery.update(dt, speed, this.felt.yaw)
    stepSuspension(this.susp, this.felt, dt)
    this.cargo.setCarPose(this.susp)
    this.cargo.applyFelt(
      this.items.map((i) => i.body),
      this.felt,
      dt,
    )
    this.cargo.step()
    this.trackCargo(dt)
    this.stepDebris(dt, speed)

    if (this.phase === 'playing') {
      this.stepHover(dt)
      this.stats.km += KM_PER_SECOND * this.felt.speed * dt
      if (isGameOver(this.stats)) this.finish(false)
      else if (this.stats.km >= ARRIVAL_KM) this.finish(true)
    } else if (this.overTimer > 0) {
      this.overTimer -= dt
      if (this.overTimer <= 0) this.showResult()
    }
  }

  private scheduleEvents(): void {
    while (this.pending && this.time >= this.pending.at - this.pending.lead) {
      this.announce(this.pending)
      this.active.push(this.pending)
      this.pending = nextEvent(this.rng, this.pending.at)
    }
  }

  private announce(e: RoadEvent): void {
    const s = this.susp
    if (e.kind === 'bump' || e.kind === 'pothole') {
      const distance = ROAD_SPEED * e.lead - AXLE_Z.front
      let front = false
      let rear = false
      this.scenery.addObstacle(e.kind, distance, e.dir, (z) => {
        const hit = (axle: 'front' | 'rear') => {
          if (e.kind === 'bump') hitBump(s, axle, e.strength)
          else hitPothole(s, e.dir, e.strength * (axle === 'front' ? 1 : 0.8))
          this.sfx.bump(e.kind === 'bump' ? e.strength : e.strength * 1.4)
        }
        if (!front && z >= AXLE_Z.front) {
          front = true
          hit('front')
        }
        if (!rear && z >= AXLE_Z.rear) {
          rear = true
          hit('rear')
        }
        return false
      })
      this.say(e.kind === 'bump' ? 'Polisi tidur!' : `Lubang di ${e.dir < 0 ? 'kiri' : 'kanan'}!`, e.lead)
    } else if (e.kind === 'curve') {
      this.say(e.dir < 0 ? '⟵ Tikungan kiri' : 'Tikungan kanan ⟶', e.lead + e.duration * 0.6)
    } else {
      this.say('Motor nyelonong! Rem!', e.lead + e.duration * 0.5)
      if (this.phase === 'playing') this.sfx.horn()
    }
  }

  /** Road warnings only matter while there is a stack to save. */
  private say(text: string, seconds: number): void {
    if (this.phase === 'playing') this.hud.banner(text, seconds)
  }

  private trackCargo(dt: number): void {
    let top = ROOF.topY
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]!
      const p = item.body.translation()
      const v = item.body.linvel()
      const speed = Math.hypot(v.x, v.y, v.z)
      if (item.lastVy < -1.2 && v.y > item.lastVy + 1) this.sfx.land(-item.lastVy, item.kind.id)
      item.lastVy = v.y
      const change = trackItem(item.track, { y: p.y, speed }, dt)
      if (change === 'loaded' && this.phase === 'playing') {
        this.stats.loaded++
        this.hud.setScore(this.stats.loaded, this.stats.dropped)
        this.hud.toast(`+1 ${item.kind.name}`)
        this.sfx.loaded()
      } else if (change === 'lost') {
        if (this.phase === 'playing') {
          this.stats.dropped++
          this.hud.setScore(this.stats.loaded, this.stats.dropped)
          this.hud.toast(`${item.kind.name} jatuh!`, true)
          this.sfx.lost()
        }
        this.toDebris(item)
        this.items.splice(i, 1)
        continue
      }
      if (speed < 0.6) top = Math.max(top, p.y + verticalExtent(item.kind.shape, item.body.rotation()))
    }
    this.stackTop = top
  }

  private toDebris(item: Cargo): void {
    const v = item.body.linvel()
    const w = item.body.angvel()
    this.cargo.removeItem(item.body)
    this.debris.push({ mesh: item.mesh, vel: new THREE.Vector3(v.x, v.y, v.z), spin: new THREE.Vector3(w.x, w.y, w.z) })
  }

  private stepDebris(dt: number, speed: number): void {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]!
      d.vel.y -= 9.81 * dt
      d.vel.z += (speed - d.vel.z) * Math.min(1, dt * 1.5)
      d.mesh.position.addScaledVector(d.vel, dt)
      d.mesh.rotation.x += d.spin.x * dt
      d.mesh.rotation.z += d.spin.z * dt
      if (d.mesh.position.y <= 0.2) {
        d.mesh.position.y = 0.2
        // On the asphalt it stops dead in the road's frame and scrolls away.
        this.scenery.carry(d.mesh)
        this.debris.splice(i, 1)
      }
    }
  }

  private stepHover(dt: number): void {
    if (!this.hover) {
      this.spawnDelay -= dt
      if (this.spawnDelay <= 0) this.spawnHover()
      return
    }
    const h = this.hover
    h.age += dt
    const d = difficulty(this.time)
    const range = h.axis === 'x' ? HOVER_RANGE.x : HOVER_RANGE.z
    h.phase += (lerp(0.75, 1.5, d) / range) * dt
    this.hud.setTimer(1 - h.age / h.limit)
    if (h.age >= h.limit) this.drop()
  }

  private spawnHover(): void {
    const kind = pickWeighted(this.rng, ITEMS)
    const mesh = buildItemMesh(kind)
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rng() < 0.5 ? 0 : Math.PI / 2)
    const axis = this.nextAxis
    this.nextAxis = axis === 'x' ? 'z' : 'x'
    this.hover = {
      kind,
      mesh,
      rot,
      axis,
      phase: this.rng() * 2,
      offset: (this.rng() - 0.5) * 0.5,
      age: 0,
      limit: lerp(HOVER_TIME, 2.8, difficulty(this.time)),
    }
    mesh.quaternion.copy(rot)
    mesh.position.copy(this.hoverPosition(this.hover))
    this.scene.add(mesh)
    this.hud.setNext(kind.name, kind.mass)
  }

  private hoverPosition(h: Hover): THREE.Vector3 {
    const y = this.stackTop + HOVER_GAP + verticalExtent(h.kind.shape, h.rot)
    const s = tri(h.phase)
    return h.axis === 'x'
      ? new THREE.Vector3(s * HOVER_RANGE.x, y, ROOF.centerZ + h.offset)
      : new THREE.Vector3(h.offset, y, ROOF.centerZ + s * HOVER_RANGE.z)
  }

  private drop(): void {
    if (this.phase !== 'playing' || !this.hover) return
    const h = this.hover
    const body = this.cargo.addItem(h.kind, h.mesh.position, h.rot)
    this.items.push({ kind: h.kind, body, mesh: h.mesh, track: newTrack(), lastVy: 0 })
    this.sfx.drop()
    this.hover = null
    this.spawnDelay = 0.8
    this.hud.setNext(null)
    this.marker.visible = false
    this.dropLine.visible = false
  }

  private finish(arrived: boolean): void {
    this.phase = 'over'
    if (this.hover) {
      this.scene.remove(this.hover.mesh)
      this.hover = null
    }
    this.marker.visible = false
    this.dropLine.visible = false
    this.hud.setNext(null)
    this.hud.banner('', 0)
    this.arrived = arrived
    this.overTimer = 1.2
  }

  private showResult(): void {
    const score = this.stats.loaded
    if (score > this.best) {
      this.best = score
      writeBest(score)
    }
    const onRoof = this.items.filter((i) => i.track.phase === 'loaded').length
    if (this.arrived) this.sfx.arrived()
    else this.sfx.gameOver()
    if (this.arrived) {
      this.hud.showOver('Sampai kampung!', `${onRoof} barang selamat sampai rumah Emak.`, score, this.stats.km, this.best)
    } else {
      const lines = ['Emak udah nelpon terus…', 'Barangnya dipungut orang di jalan.', 'Mending naik bus aja tahun depan.']
      this.hud.showOver(`${MAX_DROPS} barang jatuh!`, lines[Math.floor(Math.random() * lines.length)]!, score, this.stats.km, this.best)
    }
    this.overTimer = -1
  }

  private syncVisuals(dt: number): void {
    this.car.update(this.susp, ROAD_SPEED * this.felt.speed, WHEEL_RADIUS, dt)
    this.sfx.drive(this.felt.speed, this.phase === 'playing')
    for (const item of this.items) {
      const p = item.body.translation()
      const q = item.body.rotation()
      item.mesh.position.set(p.x, p.y, p.z)
      item.mesh.quaternion.set(q.x, q.y, q.z, q.w)
    }

    if (this.hover) {
      const target = this.hoverPosition(this.hover)
      const mesh = this.hover.mesh
      mesh.position.x = target.x
      mesh.position.z = target.z
      mesh.position.y += (target.y - mesh.position.y) * Math.min(1, dt * 6)
      const surface = this.cargo.surfaceBelow(mesh.position.x, mesh.position.y, mesh.position.z)
      const onCar = surface !== null && surface > ROOF.topY - 0.15
      this.marker.visible = true
      this.marker.position.set(mesh.position.x, (surface ?? 0) + 0.02, mesh.position.z)
      ;(this.marker.material as THREE.MeshBasicMaterial).color.set(onCar ? '#2f9e5b' : '#e8542f')
      const bottom = mesh.position.y - verticalExtent(this.hover.kind.shape, this.hover.rot)
      const line = this.dropLine.geometry.attributes.position as THREE.BufferAttribute
      line.setXYZ(0, mesh.position.x, bottom, mesh.position.z)
      line.setXYZ(1, mesh.position.x, (surface ?? 0) + 0.02, mesh.position.z)
      line.needsUpdate = true
      this.dropLine.visible = true
    }

    if (this.phase === 'playing') this.hud.setRoute(this.stats.km)

    // Camera rises and pulls back with the stack, sways into corners and shakes over bumps.
    const height = Math.max(0, this.stackTop - ROOF.topY)
    this.focusY += (Math.max(1.9, this.stackTop + 0.25) - this.focusY) * Math.min(1, dt * 2)
    const portrait = this.camera.aspect < 0.8 ? 1.3 : 1
    const back = (1 + height * 0.25) * portrait
    const shake = this.susp.heave.vel * 0.03
    this.camera.position.set(4.4 * back - this.felt.x * 0.06, this.focusY + 1.6 * back + shake, 6.2 * back)
    this.camera.lookAt(0, this.focusY - 0.2, 0.2)
  }
}
