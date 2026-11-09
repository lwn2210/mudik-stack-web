# mudik-stack-web — Status: PROTOTIPE (milestone 1)

## Apa ini
Game web 3D: tumpuk barang mudik di atap mobil yang lagi jalan di Pantura. TypeScript + Vite 8 + Three.js + Rapier (`@dimforge/rapier3d`, WASM terpisah lewat `vite-plugin-wasm`).

Fisikanya jalan di kerangka mobil. Mobil diam di origin, jalannya yang digeser. Rem dan tikungan sampai ke barang sebagai gaya inersia (`src/events.ts`). Polisi tidur dan lubang menggerakkan body kinematik lewat model suspensi pegas-peredam (`src/suspension.ts`), jadi guncangannya lewat kontak beneran.

## Sudah ada
- 9 jenis barang (kardus mi, koper, karung beras, galon, kasur gulung, kandang ayam, TV tabung, tikar, durian), masing-masing dengan collider dan massa sendiri
- Event jalan: polisi tidur, lubang kiri/kanan, tikungan, rem mendadak. Ada peringatan sebelum kena, dan makin sering seiring waktu
- Barang melayang dengan timer auto-drop, cincin target + garis bantu bidik
- Skor (barang yang diam di atap), 3 barang jatuh = game over, rute Jakarta → Tegal (330 km ≈ 7 menit), rekor disimpan di localStorage
- Layout desktop dan HP portrait
- Aset: model Toyota Avanza (CC BY 4.0, kredit di menu) dengan rak keranjang, truk/van Kenney (CC0) di jalur sebelah. Dikompres meshopt lewat `npm run models` (Avanza 1,06 MB → 281 KB). Lihat `public/models/README.md`
- Suara sintetis Web Audio (tanpa file): mesin dan jalan, barang mendarat (galon, TV, ayam berkotek), +1, jatuh, polisi tidur, klakson "tin tin" saat rem, game over/sampai. Tombol 🔊 atau tombol M buat mute

## Tes
- `npm run verify`: typecheck + 14 tes vitest (events, suspensi, aturan barang, extent rotasi) + build. Lulus 2026-11-03.
- Dicek di browser pane (Chromium): menu → main → barang numpuk → event → game over → layar hasil. Tanpa error console.
- Safari iOS (iPhone 17 simulator, 2026-11-03): WebGL, WASM Rapier, model, sentuhan, dan AudioContext jalan. Barang numpuk dan dapat skor.

## Gap
- Ukuran build: WASM Rapier 3,1 MB (1,19 MB gzip, ±850 KB brotli) + JS 230 KB gzip + model 345 KB. Totalnya masih di bawah versi pertama (1,82 MB gzip, waktu itu tanpa model). WASM-nya udah tanpa section debug. Kalau mau jauh lebih kecil, harus ganti engine fisika (mis. cannon-es, ±50 KB gzip), dengan risiko tumpukan kurang stabil
- Belum ada efek angin buat barang ringan
- Tuning feel belum dites manusia (kekuatan guncangan, kecepatan barang melayang)
- Safari macOS belum dicoba langsung (WebKit-nya sama dengan yang dites di iOS Simulator). Di iPhone, saklar silent ikut membisukan Web Audio
