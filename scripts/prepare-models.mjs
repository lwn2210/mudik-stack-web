// Copies the car models this game uses from ../jakarta-drive-web and squeezes
// them for the web: welded, quantized and meshopt-compressed, textures as WebP.
// Run: npm run models
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, getBounds, meshopt, prune, quantize, textureCompress, weld } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'

const SRC = new URL('../../jakarta-drive-web/public/models/', import.meta.url)
const OUT = new URL('../public/models/', import.meta.url)

await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

for (const [from, to] of [
  ['avanza-lod.glb', 'avanza.glb'],
  ['kenney/truck.glb', 'truck.glb'],
  ['kenney/van.glb', 'van.glb'],
  ['kenney/delivery.glb', 'delivery.glb'],
]) {
  const doc = await io.read(new URL(from, SRC).pathname)
  await doc.transform(
    dedup(),
    prune(),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  )
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
  const b = getBounds(scene)
  const size = b.max.map((v, i) => (v - b.min[i]).toFixed(3))
  const wheels = doc
    .getRoot()
    .listNodes()
    .filter((n) => /wheel/i.test(n.getName()))
    .map((n) => `${n.getName()} ${n.getTranslation().map((v) => v.toFixed(3)).join(',')}`)
  await io.write(new URL(to, OUT).pathname, doc)
  console.log(to, 'size xyz', size.join(' × '), 'min', b.min.map((v) => v.toFixed(3)).join(','), wheels.length ? `\n  ${wheels.join('\n  ')}` : '')
}
