import * as THREE from 'three'
import { PIVOT_Y, ROOF } from './config'
import type { Suspension } from './suspension'
import { canvasTexture, centeredText } from './textures'

// The family MPV (Avanza model, see public/models/README.md) with a roof-rack
// basket bolted on. The body and basket carry the suspension pose; the wheels
// stay on the road and only spin.

const ROOF_SKIN_Y = 1.63

export class CarModel {
  readonly root = new THREE.Group()
  private readonly body = new THREE.Group()
  private readonly wheels: THREE.Object3D[] = []

  constructor(model: THREE.Object3D) {
    const source = model.clone(true)
    const bodyMesh = source.getObjectByName('Body')
    if (bodyMesh) {
      // Hang the body under the pivot so it pitches and rolls about it.
      const holder = new THREE.Group()
      holder.position.y = -PIVOT_Y
      holder.add(bodyMesh)
      this.body.add(holder)
      bodyMesh.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && /paint/i.test(o.material.name)) {
          o.material = o.material.clone()
          o.material.color.set('#e8e6e1')
          o.material.metalness = 0.5
          o.material.roughness = 0.3
        }
      })
    }
    for (const name of ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR']) {
      const wheel = source.getObjectByName(name)
      if (wheel) this.wheels.push(wheel)
    }
    this.root.add(this.body, ...this.wheels)
    this.addPlate()
    this.addRack()
  }

  private addPlate(): void {
    const plate = canvasTexture('plat', 256, 72, (ctx, w, h) => {
      ctx.fillStyle = '#f4f4f0'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#111'
      ctx.lineWidth = 6
      ctx.strokeRect(3, 3, w - 6, h - 6)
      centeredText(ctx, 'B 1446 MDK', w / 2, h / 2 + 2, 44, '#111')
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.12), new THREE.MeshStandardMaterial({ map: plate, roughness: 0.5 }))
    mesh.position.set(0, 0.56 - PIVOT_Y, 2.19)
    this.body.add(mesh)
  }

  private addRack(): void {
    const at = (y: number) => y - PIVOT_Y
    const steel = new THREE.MeshStandardMaterial({ color: '#17191c', roughness: 0.5, metalness: 0.5 })
    const deck = canvasTexture('rak', 256, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = '#1b1d20'
      ctx.lineWidth = 9
      for (let i = 0; i <= w; i += 32) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, h)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(w, i)
        ctx.stroke()
      }
    })
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, at(y), z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.body.add(mesh)
    }
    // Mesh floor (see-through grid), frame, and feet down to the roof.
    add(
      new THREE.BoxGeometry(ROOF.halfX * 2, 0.02, ROOF.halfZ * 2),
      new THREE.MeshStandardMaterial({ map: deck, transparent: true, alphaTest: 0.4, roughness: 0.6, metalness: 0.4 }),
      0,
      ROOF.topY - 0.01,
      ROOF.centerZ,
    )
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.04, 0.07, ROOF.halfZ * 2), steel, side * (ROOF.halfX - 0.02), ROOF.topY + 0.035, ROOF.centerZ)
      add(new THREE.BoxGeometry(ROOF.halfX * 2, 0.07, 0.04), steel, 0, ROOF.topY + 0.035, ROOF.centerZ + side * (ROOF.halfZ - 0.02))
      for (const z of [-0.75, 0.75]) {
        const footH = ROOF.topY - ROOF_SKIN_Y
        add(new THREE.BoxGeometry(0.05, footH, 0.05), steel, side * 0.5, ROOF_SKIN_Y + footH / 2, ROOF.centerZ + z)
      }
    }
    for (const z of [-0.5, 0, 0.5]) add(new THREE.BoxGeometry(ROOF.halfX * 2, 0.03, 0.03), steel, 0, ROOF.topY - 0.015, ROOF.centerZ + z)
  }

  update(s: Suspension, speed: number, wheelRadius: number, dt: number): void {
    this.body.position.set(0, PIVOT_Y + s.heave.pos, 0)
    this.body.rotation.set(s.pitch.pos, 0, s.roll.pos, 'XYZ')
    // Forward is -z, so a rolling wheel turns negatively about +x.
    const spin = (speed / wheelRadius) * dt
    for (const wheel of this.wheels) wheel.rotation.x -= spin
  }
}
