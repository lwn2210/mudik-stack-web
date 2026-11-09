import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

// 3D models in public/models (see public/models/README.md for sources and
// licences). They are meshopt-compressed by scripts/prepare-models.mjs.

export interface Assets {
  /** The player's MPV: nodes "Body" and "Wheel{Front,Rear}{L,R}", facing -z, origin on the ground. */
  car: THREE.Object3D
  /** Oncoming traffic, each facing +z with its length in `userData.length`. */
  traffic: THREE.Object3D[]
}

const TRAFFIC = [
  { file: 'truck.glb', length: 6.8 },
  { file: 'delivery.glb', length: 6.2 },
  { file: 'van.glb', length: 4.8 },
]

function shadows(root: THREE.Object3D): THREE.Object3D {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return root
}

export async function loadAssets(): Promise<Assets> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const base = `${import.meta.env.BASE_URL}models/`
  const [car, ...traffic] = await Promise.all([
    loader.loadAsync(`${base}avanza.glb`),
    ...TRAFFIC.map((t) => loader.loadAsync(`${base}${t.file}`)),
  ])
  return {
    car: shadows(car!.scene),
    traffic: traffic.map((gltf, i) => {
      const root = shadows(gltf.scene)
      const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())
      const wrapper = new THREE.Group()
      root.scale.setScalar(TRAFFIC[i]!.length / size.z)
      wrapper.add(root)
      wrapper.userData.length = TRAFFIC[i]!.length
      return wrapper
    }),
  }
}
