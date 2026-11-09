import { MAX_DROPS } from './config'
import { nextStop, STOPS } from './rules'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

export class Hud {
  private readonly hud = $('hud')
  private readonly menu = $('menu')
  private readonly over = $('over')
  private readonly score = $('score')
  private readonly drops = $('drops')
  private readonly routeNext = $('route-next')
  private readonly routeKm = $('route-km')
  private readonly routeBar = $('route-bar')
  private readonly nextCard = $('next')
  private readonly nextName = $('next-name')
  private readonly nextMass = $('next-mass')
  private readonly nextTimer = $('next-timer')
  private readonly bannerEl = $('banner')
  private readonly toasts = $('toasts')
  private bannerTimer = 0
  private lastKm = -1
  private lastOver: { score: number; km: number; best: number } | null = null

  constructor() {
    this.drops.innerHTML = Array.from({ length: MAX_DROPS }, () => '<i></i>').join('')
    $('route-total').textContent = `Jakarta → ${STOPS[STOPS.length - 1]!.name}`
    $('share-score').addEventListener('click', () => this.shareResult())
  }

  onStart(fn: () => void): void {
    $('start').addEventListener('click', fn)
    $('restart').addEventListener('click', fn)
  }

  showMenu(best: number): void {
    this.menu.hidden = false
    this.over.hidden = true
    this.hud.hidden = true
    $('best').textContent = best > 0 ? `Rekor kamu: ${best}` : ''
  }

  showPlaying(): void {
    this.menu.hidden = true
    this.over.hidden = true
    this.hud.hidden = false
    this.toasts.innerHTML = ''
    this.lastKm = -1
  }

  showOver(title: string, sub: string, score: number, km: number, best: number): void {
    this.over.hidden = false
    this.lastOver = { score, km: Math.floor(km), best }
    $('over-title').textContent = title
    $('over-sub').textContent = sub
    $('over-score').textContent = String(score)
    $('over-km').textContent = `${Math.floor(km)} km`
    $('over-best').textContent = String(best)
  }

  private shareResult(): void {
    if (!this.lastOver) return
    const text =
      `🚗 REKOR MUATAN MUDIK STACK 🚗\n` +
      `📦 Barang Terangkut: ${this.lastOver.score} kardus & barang\n` +
      `🛣️ Jarak Tempuh: ${this.lastOver.km} km perjalanan mudik\n` +
      `🏆 Rekor Terbaik: ${this.lastOver.best}\n\n` +
      `Bisa tumpuk barang mudik di atap mobil lebih tinggi tanpa jatuh?\n` +
      `👉 https://lwn2210.github.io/mini-arcade/mudik-stack/`

    const btn = $('share-score')
    if (navigator.share) {
      navigator.share({ title: 'Rekor Mudik Stack!', text, url: 'https://lwn2210.github.io/mini-arcade/mudik-stack/' }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          const orig = btn.textContent
          btn.textContent = '✅ Hasil disalin ke clipboard!'
          setTimeout(() => (btn.textContent = orig), 2500)
        })
        .catch(() => {
          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
        })
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  get playing(): boolean {
    return !this.hud.hidden && this.over.hidden
  }

  setScore(score: number, dropped: number): void {
    this.score.textContent = String(score)
    this.drops.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < dropped))
  }

  setRoute(km: number): void {
    const whole = Math.floor(km)
    if (whole === this.lastKm) return
    this.lastKm = whole
    const stop = nextStop(km)
    this.routeNext.textContent = stop.name
    this.routeKm.textContent = `${Math.max(0, Math.ceil(stop.km - km))} km`
    this.routeBar.style.width = `${Math.min(100, (km / STOPS[STOPS.length - 1]!.km) * 100)}%`
  }

  setNext(name: string | null, mass = 0): void {
    this.nextCard.style.visibility = name ? 'visible' : 'hidden'
    if (!name) return
    this.nextName.textContent = name
    this.nextMass.textContent = `${mass} kg`
  }

  setTimer(fraction: number): void {
    this.nextTimer.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`
  }

  banner(text: string, seconds: number): void {
    this.bannerEl.textContent = text
    this.bannerEl.classList.add('show')
    clearTimeout(this.bannerTimer)
    this.bannerTimer = window.setTimeout(() => this.bannerEl.classList.remove('show'), seconds * 1000)
  }

  toast(text: string, bad = false): void {
    const el = document.createElement('div')
    el.className = bad ? 'toast bad' : 'toast'
    el.textContent = text
    this.toasts.appendChild(el)
    setTimeout(() => el.remove(), 1300)
  }
}
