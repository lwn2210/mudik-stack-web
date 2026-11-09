// Every sound is synthesised with Web Audio, so there are no files to ship.
// The context starts on the first tap or key press (iOS and Safari refuse to
// play before one). Note: on iPhone, the silent switch also mutes Web Audio.

const MUTE_KEY = 'mudik-stack.mute'

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private engine: { gain: GainNode; osc: OscillatorNode; road: GainNode } | null = null
  muted = readMuted()

  constructor() {
    const unlock = () => this.unlock()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    window.addEventListener('touchend', unlock)
  }

  private unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.8
      this.master.connect(this.ctx.destination)
      const length = this.ctx.sampleRate * 2
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state !== 'running') void this.ctx.resume()
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0')
    } catch {
      // Not remembered; fine.
    }
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05)
    return this.muted
  }

  private ready(): AudioContext | null {
    return this.ctx && this.ctx.state === 'running' && this.master ? this.ctx : null
  }

  private tone(type: OscillatorType, from: number, to: number, start: number, length: number, volume: number): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, start)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + length)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
    osc.connect(gain).connect(this.master!)
    osc.start(start)
    osc.stop(start + length + 0.02)
  }

  private hiss(filter: BiquadFilterType, freq: number, q: number, start: number, length: number, volume: number, sweepTo?: number): void {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const bq = ctx.createBiquadFilter()
    bq.type = filter
    bq.frequency.setValueAtTime(freq, start)
    if (sweepTo) bq.frequency.exponentialRampToValueAtTime(sweepTo, start + length)
    bq.Q.value = q
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
    src.connect(bq).connect(gain).connect(this.master!)
    src.start(start, Math.random())
    src.stop(start + length + 0.02)
  }

  /** Engine and road rumble; call every frame while the car drives. */
  drive(speedFactor: number, on: boolean): void {
    const ctx = this.ready()
    if (!ctx) return
    if (!this.engine) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 260
      const gain = ctx.createGain()
      gain.gain.value = 0
      osc.connect(lp).connect(gain).connect(this.master!)
      osc.start()
      const road = ctx.createGain()
      road.gain.value = 0
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      src.loop = true
      const rlp = ctx.createBiquadFilter()
      rlp.type = 'lowpass'
      rlp.frequency.value = 500
      src.connect(rlp).connect(road).connect(this.master!)
      src.start()
      this.engine = { gain, osc, road }
    }
    const t = ctx.currentTime
    this.engine.osc.frequency.setTargetAtTime(38 + 22 * speedFactor, t, 0.2)
    this.engine.gain.gain.setTargetAtTime(on ? 0.05 : 0.02, t, 0.3)
    this.engine.road.gain.setTargetAtTime(on ? 0.05 * speedFactor : 0.02, t, 0.3)
  }

  /** An item hitting the rack or the stack. `impact` is the speed it hit at, m/s. */
  land(impact: number, kind: string): void {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    const v = Math.min(0.5, 0.08 + impact * 0.09)
    this.tone('sine', 140, 45, t, 0.22, v)
    this.hiss('lowpass', 900, 0.7, t, 0.08, v * 0.6)
    if (kind === 'galon') this.tone('sine', 300, 180, t + 0.02, 0.25, v * 0.35)
    if (kind === 'kandang') this.cluck(t + 0.05)
    if (kind === 'tv') this.hiss('bandpass', 2600, 4, t, 0.15, v * 0.4)
  }

  private cluck(t: number): void {
    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.11 + Math.random() * 0.03
      this.tone('square', 700 + Math.random() * 300, 450, at, 0.07, 0.05)
      this.hiss('bandpass', 1300, 3, at, 0.05, 0.06)
    }
  }

  drop(): void {
    const ctx = this.ready()
    if (!ctx) return
    this.hiss('bandpass', 1400, 1.2, ctx.currentTime, 0.25, 0.08, 400)
  }

  loaded(): void {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    this.tone('triangle', 880, 880, t, 0.12, 0.12)
    this.tone('triangle', 1320, 1320, t + 0.09, 0.18, 0.12)
  }

  lost(): void {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    this.tone('triangle', 520, 140, t, 0.55, 0.14)
    this.tone('sine', 110, 40, t + 0.35, 0.3, 0.3)
    this.hiss('lowpass', 600, 0.7, t + 0.35, 0.2, 0.25)
  }

  bump(strength: number): void {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    this.tone('sine', 90, 35, t, 0.2, Math.min(0.45, 0.2 * strength))
    this.hiss('bandpass', 2200, 2, t + 0.02, 0.18, 0.06 * strength)
  }

  /** "Tin tin!" when a motorbike cuts in. */
  horn(): void {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    for (const at of [t, t + 0.24]) {
      this.tone('square', 415, 415, at, 0.16, 0.05)
      this.tone('square', 523, 523, at, 0.16, 0.04)
    }
  }

  gameOver(): void {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    ;[392, 370, 349, 294].forEach((f, i) => this.tone('triangle', f, f * 0.98, t + i * 0.28, i === 3 ? 0.7 : 0.26, 0.13))
  }

  arrived(): void {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    ;[523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, t + i * 0.13, i === 3 ? 0.6 : 0.14, 0.13))
  }
}
