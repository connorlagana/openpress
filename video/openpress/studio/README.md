# OpenPress promotional film

A silent, 20-second, 1920×1080, 60 fps Remotion video. All typing, cursor motion,
site assembly, theme changes, publishing status, and camera moves are rendered
from React. No screen recording or live account is used.

## Review

- `out/openpress-promo-1080p.mp4` — high-quality master
- `out/openpress-promo-web.mp4` — 1280×720 / 60 fps web encode
- `out/poster.jpg` — published-site still
- `out/review.html` — local video player with key frames
- `../STORYBOARD.md` — sequence and art direction

The existing landing page is unchanged. All exports are local and ignored by Git.

## Commands

```sh
npm ci
npm run dev -- --port=3400
npm run lint
npx remotion render src/index.ts OpenPress out/openpress-promo-1080p.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p
npx remotion still src/index.ts OpenPress out/poster.png --frame=1020
```

For the installed Chrome on this Mac, append:
`--browser-executable='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`.
Otherwise Remotion may download Chrome Headless Shell.

Web delivery encode:

```sh
ffmpeg -i out/openpress-promo-1080p.mp4 -vf scale=1280:720 -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart -an out/openpress-promo-web.mp4
```

## Editing

`src/Composition.tsx` contains the continuous shot, using frame-driven animation
only. The `Chat` and `Browser` components hold the two interface designs.
`src/Root.tsx` defines duration, dimensions, and frame rate. Timing is expressed
in seconds using `useVideoConfig().fps`.

The fictional AI workspace is deliberately unbranded. Elsewhere is demonstration
content derived from the existing landing-page example. The displayed
`elsewhere.openpress.blog` URL is illustrative; this task does not deploy a site.
The workflow starts after OpenPress has been connected, with publishing allowed.

## Assets and provenance

- Travel photo: existing landing-page asset, fetched at 2000px from
  https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=2000&q=90&fit=crop
  (see the main repository's `public/images/landing/README.md`).
- Geist variable font: copied from the current site's generated font assets.
- Editorial serif: Georgia, matching the landing page's warm theme fallback.
- Official Remotion guidance is stored locally in `../.skills/` (Git-ignored).
- Remotion and all Remotion packages are pinned to 4.0.536.

For later landing-page integration: use muted inline video, retain a pause control,
reserve the aspect ratio, use the poster for reduced motion, and pause playback
when offscreen. This desktop composition should get a separate crop/layout for
small portrait placements rather than shrinking its interface text excessively.

## Three alternate films

Open `out/alternatives/index.html` through the local review server, or select
these compositions in Remotion Studio:

| Composition | Direction | File |
| --- | --- | --- |
| SayItShipIt | Dark kinetic typography, lime wipe, perspective browser, publish stamp | `out/alternatives/01-say-it-ship-it.mp4` |
| SomewhereWorthSharing | Full-bleed photography, shutter transition, editorial site | `out/alternatives/02-somewhere-worth-sharing.mp4` |
| MakeItMine | Springing messages, orange color burst, portfolio restyling | `out/alternatives/03-make-it-mine.mp4` |

Each is 18 seconds / 1080p / 60 fps. Corresponding `-web.mp4` files are 720p / 60 fps.
Posters are `01-poster.jpg`, `02-poster.jpg`, and `03-poster.jpg`.

Source: `src/alternatives/`. `motion.tsx` contains reusable text reveals, wipes,
color bursts, publish stamps, and confetti. `shared.tsx` contains the illustrative
journal and portfolio. Interior photo is copied from the landing page's
`design.jpg`; FORMA is a fictional graphic created in code.

Rendering these alternatives on this Mac uses `--gl=swangle` to avoid an
intermittent Chrome GPU screenshot-tiling artifact. Example:

```sh
npx remotion render src/index.ts SayItShipIt out/alternatives/01-say-it-ship-it.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p --concurrency=2 --gl=swangle --browser-executable='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

The original film and its source component are preserved. The alternative
films incorporate the follow-up request for stronger hooks and flashier motion.
