import * as RAPIER from '@dimforge/rapier3d'
import * as THREE from 'three'
import { GRAVITY, PHYSICS_DT, PIVOT_Y, ROOF } from './config'
import type { ItemKind } from './items'
import type { Suspension } from './suspension'

// Rapier world in the car's frame. The car is one kinematic body driven by
// the suspension model; the cargo is dynamic and gets the inertial push of
// braking and cornering as impulses every step. The WASM binary loads as its
// own file (vite-plugin-wasm), before this module finishes evaluating.

const euler = new THREE.Euler()
const quat = new THREE.Quaternion()

export class CargoWorld {
  readonly world: RAPIER.World
  readonly car: RAPIER.RigidBody

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 })
    this.world.timestep = PHYSICS_DT
    this.car = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, PIVOT_Y, 0))
    this.buildCar()
  }

  private buildCar(): void {
    const local = (y: number) => y - PIVOT_Y
    const add = (desc: RAPIER.ColliderDesc) => this.world.createCollider(desc.setFriction(0.9).setRestitution(0.02), this.car)
    // Lower body and cabin, so cargo that slides off bounces down the sides.
    add(RAPIER.ColliderDesc.cuboid(0.85, 0.4, 2.05).setTranslation(0, local(0.65), 0.1))
    add(RAPIER.ColliderDesc.cuboid(0.75, 0.29, 1.25).setTranslation(0, local(1.34), 0.65))
    // Roof rack plate and its low lips.
    const plateY = local(ROOF.topY - 0.03)
    add(RAPIER.ColliderDesc.cuboid(ROOF.halfX, 0.03, ROOF.halfZ).setTranslation(0, plateY, ROOF.centerZ))
    const lip = 0.035
    for (const side of [-1, 1]) {
      add(RAPIER.ColliderDesc.cuboid(0.025, lip, ROOF.halfZ).setTranslation(side * (ROOF.halfX - 0.025), local(ROOF.topY + lip), ROOF.centerZ))
      add(RAPIER.ColliderDesc.cuboid(ROOF.halfX, lip, 0.025).setTranslation(0, local(ROOF.topY + lip), ROOF.centerZ + side * (ROOF.halfZ - 0.025)))
    }
  }

  /** Moves the car body to the suspension's pose for the next step. */
  setCarPose(s: Suspension): void {
    this.car.setNextKinematicTranslation({ x: 0, y: PIVOT_Y + s.heave.pos, z: 0 })
    euler.set(s.pitch.pos, 0, s.roll.pos, 'XYZ')
    quat.setFromEuler(euler)
    this.car.setNextKinematicRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
  }

  addItem(kind: ItemKind, position: THREE.Vector3, rotation: THREE.Quaternion): RAPIER.RigidBody {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
      .setCanSleep(false)
      .setLinearDamping(0.05)
      .setAngularDamping(kind.angularDamping ?? 0.3)
    const body = this.world.createRigidBody(desc)
    const shape = kind.shape
    let collider: RAPIER.ColliderDesc
    if (shape.type === 'box') {
      collider = RAPIER.ColliderDesc.cuboid(...shape.half)
    } else if (shape.type === 'cylinder') {
      collider = RAPIER.ColliderDesc.cylinder(shape.halfHeight, shape.radius)
      if (shape.lying) collider.setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 })
    } else {
      collider = RAPIER.ColliderDesc.ball(shape.radius)
    }
    collider.setMass(kind.mass).setFriction(kind.friction).setRestitution(kind.restitution ?? 0.03)
    this.world.createCollider(collider, body)
    return body
  }

  removeItem(body: RAPIER.RigidBody): void {
    this.world.removeRigidBody(body)
  }

  /** Inertial push on every cargo body: m·a·dt. */
  applyFelt(bodies: Iterable<RAPIER.RigidBody>, felt: { x: number; z: number }, dt: number): void {
    if (felt.x === 0 && felt.z === 0) return
    for (const body of bodies) {
      const m = body.mass()
      body.applyImpulse({ x: m * felt.x * dt, y: 0, z: m * felt.z * dt }, true)
    }
  }

  step(): void {
    this.world.step()
  }

  /** Height of the first surface straight below (x, fromY, z), or null over open road. */
  surfaceBelow(x: number, fromY: number, z: number): number | null {
    const ray = new RAPIER.Ray({ x, y: fromY, z }, { x: 0, y: -1, z: 0 })
    const hit = this.world.castRay(ray, fromY, true)
    return hit ? fromY - hit.timeOfImpact : null
  }

  dispose(): void {
    this.world.free()
  }
}
