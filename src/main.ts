import './style.css'
import { loadAssets } from './assets'

async function boot(): Promise<void> {
  const overlay = document.getElementById('boot')!
  const status = document.getElementById('boot-status')!
  const retry = document.getElementById('boot-retry') as HTMLButtonElement
  const start = document.getElementById('start') as HTMLButtonElement

  // A reload also retries failed dynamic module imports without creating a second game.
  retry.addEventListener('click', () => window.location.reload())
  try {
    // Canvas labels use the display font, so wait for it (briefly) before painting textures.
    const font = Promise.race([document.fonts.load('40px "Lilita One"'), new Promise((r) => setTimeout(r, 1500))])
    // Models and the game module (which pulls in Rapier's WASM) load in parallel with the font.
    const [{ Game }, assets] = await Promise.all([import('./game'), loadAssets(), font])
    new Game(document.getElementById('scene') as HTMLCanvasElement, assets)
    start.disabled = false
    document.getElementById('mute')!.hidden = false
    overlay.hidden = true
  } catch {
    document.getElementById('menu')!.hidden = true
    start.disabled = true
    status.textContent = 'Gagal memuat game. Periksa koneksi, lalu muat ulang untuk mencoba lagi.'
    retry.hidden = false
  }
}

void boot()
