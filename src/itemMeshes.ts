import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { ItemKind } from './items'
import { canvasTexture, centeredText, speckle } from './textures'

// Visuals for each cargo kind, built in the same body frame as its collider.

const std = (params: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...params })

function kardusMaterials(): THREE.Material[] {
  const side = canvasTexture('kardus-side', 256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#c89356'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 400, 0.12)
    ctx.fillStyle = '#d63a2a'
    ctx.fillRect(18, 38, w - 36, 64)
    centeredText(ctx, 'MI GORENG', w / 2, 72, 40, '#fff6d8')
    centeredText(ctx, 'isi 40 bungkus', w / 2, 126, 20, '#6b4423', 600)
  })
  const top = canvasTexture('kardus-top', 256, 180, (ctx, w, h) => {
    ctx.fillStyle = '#c89356'
    ctx.fillRect(0, 0, w, h)
    speckle(ctx, w, h, 400, 0.12)
    ctx.fillStyle = 'rgba(214, 190, 140, 0.85)'
    ctx.fillRect(0, h / 2 - 16, w, 32)
    ctx.strokeStyle = 'rgba(90, 60, 30, 0.5)'
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()
  })
  const s = std({ map: side })
  const t = std({ map: top })
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
  return [s, s, t, t, s, s]
}

function sackTexture(): THREE.Texture {
  return canvasTexture('karung', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ece8dc'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(150, 140, 120, 0.35)'
    for (let i = 0; i < w; i += 4) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(w, i)
      ctx.stroke()
    }
    centeredText(ctx, 'BERAS', w / 2, h / 2 - 22, 54, '#2f8a3c')
    centeredText(ctx, '25 kg', w / 2, h / 2 + 30, 34, '#c23b2b')
  })
}

function stripedTexture(key: string, a: string, b: string, stripes: number): THREE.Texture {
  return canvasTexture(key, 256, 64, (ctx, w, h) => {
    const step = w / stripes
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? a : b
      ctx.fillRect(i * step, 0, step, h)
    }
    speckle(ctx, w, h, 200, 0.08)
  })
}

function weaveTexture(): THREE.Texture {
  return canvasTexture('anyaman', 128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = '#b8894a'
    ctx.lineWidth = 7
    for (let i = 8; i < w; i += 20) {
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
}

function chicken(): THREE.Group {
  const g = new THREE.Group()
  const white = std({ color: '#f4efe6' })
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), white)
  body.scale.set(1.25, 0.95, 0.9)
  body.position.y = -0.06
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), white)
  head.position.set(0.13, 0.06, 0)
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.015), std({ color: '#d8262a' }))
  comb.position.set(0.14, 0.12, 0)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 6), std({ color: '#f2b21b' }))
  beak.rotation.z = -Math.PI / 2
  beak.position.set(0.2, 0.06, 0)
  g.add(body, head, comb, beak)
  return g
}

function durianGeometry(radius: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    // Spikes on a deterministic pattern so every durian looks alike.
    const spike = 1 + 0.16 * Math.max(0, Math.sin(v.x * 61) * Math.sin(v.y * 53) * Math.sin(v.z * 47))
    v.multiplyScalar(spike)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

const SUITCASE_COLOURS = ['#c0392b', '#2c3e50', '#7d3c98', '#138d75', '#d35400']

export function buildItemMesh(kind: ItemKind): THREE.Object3D {
  const shape = kind.shape
  let root: THREE.Object3D
  switch (kind.id) {
    case 'kardus': {
      const [x, y, z] = shape.type === 'box' ? shape.half : [0.25, 0.15, 0.2]
      root = new THREE.Mesh(new THREE.BoxGeometry(x * 2, y * 2, z * 2), kardusMaterials())
      break
    }
    case 'koper': {
      const [x, y, z] = shape.type === 'box' ? shape.half : [0.3, 0.12, 0.2]
      const colour = SUITCASE_COLOURS[Math.floor(Math.random() * SUITCASE_COLOURS.length)]!
      const group = new THREE.Group()
      const shell = new THREE.Mesh(new RoundedBoxGeometry(x * 2, y * 2, z * 2, 3, 0.05), std({ color: colour, roughness: 0.45 }))
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), std({ color: '#222' }))
      handle.position.set(0, y + 0.012, 0)
      const band = new THREE.Mesh(new THREE.BoxGeometry(x * 2 + 0.01, y * 2 + 0.01, 0.03), std({ color: '#f1c40f' }))
      group.add(shell, handle, band)
      root = group
      break
    }
    case 'karung': {
      const [x, y, z] = shape.type === 'box' ? shape.half : [0.25, 0.12, 0.35]
      root = new THREE.Mesh(new RoundedBoxGeometry(x * 2, y * 2, z * 2, 4, 0.09), std({ map: sackTexture() }))
      break
    }
    case 'galon': {
      const r = shape.type === 'cylinder' ? shape.radius : 0.14
      const hh = shape.type === 'cylinder' ? shape.halfHeight : 0.24
      const group = new THREE.Group()
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, hh * 2 - 0.06, 24),
        new THREE.MeshPhysicalMaterial({ color: '#58b4f0', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.62, clearcoat: 1 }),
      )
      water.position.y = -0.03
      const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.05, r, 0.06, 24), water.material)
      shoulder.position.y = hh - 0.03
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 16), std({ color: '#1f5fbf', roughness: 0.4 }))
      cap.position.y = hh + 0.015
      const label = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.003, r + 0.003, 0.1, 24, 1, true), std({ color: '#e8f4ff' }))
      label.position.y = -0.02
      group.add(water, shoulder, cap, label)
      root = group
      break
    }
    case 'kasur': {
      const r = shape.type === 'cylinder' ? shape.radius : 0.2
      const hh = shape.type === 'cylinder' ? shape.halfHeight : 0.6
      const group = new THREE.Group()
      const tex = stripedTexture('kasur', '#f3a7b7', '#fdf3f0', 18)
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hh * 2, 24), std({ map: tex }))
      roll.rotation.z = Math.PI / 2
      group.add(roll)
      for (const x of [-hh * 0.55, hh * 0.55]) {
        const tie = new THREE.Mesh(new THREE.TorusGeometry(r + 0.004, 0.012, 6, 24), std({ color: '#e03a2f' }))
        tie.rotation.y = Math.PI / 2
        tie.position.x = x
        group.add(tie)
      }
      root = group
      break
    }
    case 'kandang': {
      const [x, y, z] = shape.type === 'box' ? shape.half : [0.3, 0.22, 0.22]
      const group = new THREE.Group()
      const cage = new THREE.Mesh(
        new THREE.BoxGeometry(x * 2, y * 2, z * 2),
        std({ map: weaveTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
      )
      const floor = new THREE.Mesh(new THREE.BoxGeometry(x * 2, 0.02, z * 2), std({ color: '#8d6236' }))
      floor.position.y = -y + 0.01
      const hen = chicken()
      hen.position.y = -0.04
      group.add(cage, floor, hen)
      root = group
      break
    }
    case 'tv': {
      const [x, y, z] = shape.type === 'box' ? shape.half : [0.26, 0.22, 0.24]
      const group = new THREE.Group()
      const body = new THREE.Mesh(new RoundedBoxGeometry(x * 2, y * 2, z * 2, 3, 0.03), std({ color: '#6b5a48', roughness: 0.6 }))
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(x * 1.45, y * 1.4), std({ color: '#1b2a2f', roughness: 0.15, metalness: 0.2 }))
      screen.position.set(-x * 0.15, 0, z + 0.002)
      group.add(body, screen)
      for (const side of [-1, 1]) {
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 4), std({ color: '#bbb', metalness: 0.8 }))
        antenna.position.set(side * 0.06, y + 0.13, 0)
        antenna.rotation.z = side * -0.45
        group.add(antenna)
      }
      root = group
      break
    }
    case 'tikar': {
      const r = shape.type === 'cylinder' ? shape.radius : 0.08
      const hh = shape.type === 'cylinder' ? shape.halfHeight : 0.55
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hh * 2, 18), std({ map: stripedTexture('tikar', '#d8b45c', '#7aa64a', 10) }))
      roll.rotation.z = Math.PI / 2
      root = roll
      break
    }
    case 'durian': {
      const r = shape.type === 'ball' ? shape.radius : 0.17
      const group = new THREE.Group()
      const fruit = new THREE.Mesh(durianGeometry(r * 0.92), std({ color: '#8c9a3a', flatShading: true }))
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.07, 6), std({ color: '#5b4a2a' }))
      stem.position.y = r
      group.add(fruit, stem)
      root = group
      break
    }
    default:
      root = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), std({ color: '#999' }))
  }
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return root
}
