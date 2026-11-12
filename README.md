# TTB project page

Project page for **TTB: Test-time Baking for Efficient Rendering of Decoder-only View Synthesis Models** (NeurIPS 2026, Spotlight).

Built on [Roman Hauksson's academic project page template](https://github.com/RomanHauksson/academic-project-astro-template) (Astro 6, Tailwind 4, MDX, KaTeX). The template is CC BY-SA 4.0, so the credit line in the footer must stay.

## Develop

```bash
npm install          # Node 24 or newer
npm run dev          # http://localhost:4321
npm run build        # astro check + static build into ./dist
```

## Where things live

| What | Where |
| --- | --- |
| Page content | `src/paper.mdx` |
| Components | `src/components/` |
| Page frame (nav bar, table of contents, footer, fonts) | `src/pages/index.astro` |
| Theme tokens and width tiers | `src/styles/global.css` |
| Videos, posters, camera paths | `public/video/`, `public/traj/` |

## Deploy

`.github/workflows/astro.yml` builds the site and deploys it to GitHub Pages on every push to `main` (repository Settings → Pages → Source: GitHub Actions). The workflow passes the Pages origin and base path to `astro build`.

For another host, set the base path and site URL at build time:

```bash
BASE_PATH=/labs/twn/ttb SITE_URL=https://research.nvidia.com npm run build
```

## Fonts

The page is set in [Noto Sans](https://fonts.google.com/noto/specimen/Noto+Sans) (SIL Open Font License 1.1), the template's default. Astro's Fonts API downloads it from Google Fonts at build time and serves it with the page; no font files are stored in the repository. To change it, edit `fonts` in `astro.config.ts` and the `--font-noto-sans` variable in `src/pages/index.astro`.
