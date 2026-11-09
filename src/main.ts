import './style.css'
import { loadAssets } from './assets'

async function boot(): Promise<void> {
  // Canvas labels use the display font, so wait for it (briefly) before painting textures.
  const font = Promise.race([document.fonts.load('40px "Lilita One"'), new Promise((r) => setTimeout(r, 1500))])
  // Models and the game module (which pulls in Rapier's WASM) load in parallel with the font.
  const [{ Game }, assets] = await Promise.all([import('./game'), loadAssets(), font])
  new Game(document.getElementById('scene') as HTMLCanvasElement, assets)
}

void boot()
