# 🇩🇿 Algeria Wilaya Explorer

Interactive educational PWA for learning Algeria's current **69-wilaya** territorial structure, wilaya names, capitals, broad learning regions, and selected geographic/cultural facts.

**Live app:** https://algeria-map-game-olive.vercel.app

## Administrative baseline

DZMap follows **Law No. 26-06 of 4 April 2026**, published in the Algerian Official Journal No. 25 on 5 April 2026.

- **69 wilayas**
- **1,541 communes**
- 11 wilayas created in the 2026 reform: Aflou, Barika, El Kantara, Bir El Ater, El Aricha, Ksar Chellala, Aïn Ouessara, Messaad, Ksar El Boukhari, Bou Saâda, and El Abiodh Sidi Cheikh
- transfer of responsibilities from mother wilayas continues through **31 December 2026**
- full operational transition is documented for **1 January 2027**

See [DATA_SOURCES.md](DATA_SOURCES.md) for legal references, map provenance, and licensing.

## Game modes

- **Classic** — find the prompted wilaya on the map.
- **Time Attack** — find as many wilayas as possible before time expires; correct answers immediately advance to the next prompt.
- **Reverse** — identify the wilaya highlighted on the map.
- **Trivia** — answer capital or broad-learning-region questions about the highlighted wilaya.
- **Study Guide** — click wilayas and learn without score pressure.
- **Region Explorer** — explore broad North / South / East / West / Central learning groups.

> The broad learning regions are an app teaching aid, **not an official administrative tier**.

## Languages

- English
- French
- Arabic, including RTL gameplay layout

## Reliability improvements

The current app includes:

- 69-feature 2026 wilaya map
- exact 69/1,541 administrative metadata
- fixed Trivia answer validation
- fixed Trivia region-option freeze
- fixed Time Attack score preservation
- Time Attack no longer pauses for a fact card after every correct answer
- short, reduced-motion-aware victory sequence
- keyboard-operable wilaya map
- browser zoom enabled
- responsive desktop / Chromebook / tablet / phone layout
- natural page scrolling and protected map height
- persistent Dark / Light theme
- optional Firebase configuration: the learning app still runs if Firebase is not configured
- constrained Firestore leaderboard rules stored in the repository
- restored PWA/service-worker behavior and offline caching
- automated data-integrity, PWA, and game-logic tests
- GitHub Actions CI for install, lint, test, and production build

## Local development

```bash
git clone https://github.com/tinouchemassinissa/dzmap.git
cd dzmap
npm ci
npm run dev
```

Verification:

```bash
npm run lint
npm test
npm run build
```

## Optional Firebase leaderboard

Copy `.env.example` to `.env.local` and provide your Firebase web-app values.

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Firebase is optional for local learning/gameplay. If it is absent, the public leaderboard is simply unavailable.

The repository contains `firestore.rules` and `firebase.json`. Vercel deploys the web app, but **Vercel does not deploy Firestore rules**. Deploy them separately from an authenticated Firebase environment:

```bash
firebase deploy --only firestore:rules
```

Client-side rules limit obvious abuse, but a completely trusted competitive leaderboard would require server-side or attested score verification.

## PWA / offline

The map, application bundle, local audio, and other core assets are precached. External fonts and the Wikimedia Algeria flag asset are runtime-cached after successful retrieval.

The public leaderboard and external reference links require a network connection.

## Data and map licensing

Legal administrative counts and names are grounded in Algerian official sources. The 69 wilaya boundary polygons are derived from OpenStreetMap administrative relations via the GeoAlgeria dataset and are covered by **ODbL 1.0**.

**© OpenStreetMap contributors**

See [DATA_SOURCES.md](DATA_SOURCES.md) for full attribution and provenance.

## Project structure

```text
src/
  App.jsx
  audio.js
  data.js
  firebase.js
  gameLogic.js
  translations.js
  game/
    adminData.test.mjs
    gameLogic.test.mjs
    pwa.test.mjs
public/
  algeria.json
  bg_music_v2.mp3
  dz_anthem_v2.mp3
  manifest.webmanifest
firestore.rules
firebase.json
DATA_SOURCES.md
```

## License

Application code is MIT. Refer to [DATA_SOURCES.md](DATA_SOURCES.md) for third-party data licensing and attribution.
