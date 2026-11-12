import { defineConfig, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import mdx from "@astrojs/mdx";

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeCitation from "rehype-citation";

import react from "@astrojs/react";

import astroExpressiveCode from "astro-expressive-code";

// Where the page will be served from. For research.nvidia.com set e.g.
//   BASE_PATH=/labs/twn/ttb npm run build
// so that every asset URL is prefixed correctly. Defaults to "/" for local dev
// and for hosts like GitHub Pages with a custom domain.
const base = process.env.BASE_PATH ?? "/";
const site = process.env.SITE_URL ?? "https://research.nvidia.com";

// https://astro.build/config
export default defineConfig({
  site,
  base,
  vite: {
    plugins: [tailwindcss()],
    build: {
      // three.js (the 3D trajectory view) is split into its own chunk and only
      // loaded when the demo scrolls into view; its size is intentional.
      chunkSizeWarningLimit: 600,
    },
  },
  markdown: {
    // Keep "--" (as in "TTB--") and straight quotes as written.
    smartypants: false,
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      rehypeKatex,
      [
        rehypeCitation,
        {
          bibliography: "bibliography.bib",
          linkCitations: true,
        },
      ],
    ],
  },
  integrations: [
    icon(),
    astroExpressiveCode({
      styleOverrides: {
        borderRadius: "0.75rem",
        borderWidth: "0",
        codeBackground: ({ theme }) =>
          `var(--color-zinc-${theme.type === "dark" ? "800" : "100"})`,
        frames: {
          shadowColor: "transparent",
        },
      },
      themeCssSelector: (theme) =>
        theme.type === "dark" ? `[data-theme="dark"]` : `[data-theme="light"]`,
    }),
    mdx(),
    react(),
  ],
  fonts: [
    {
      // Noto Sans (SIL Open Font License 1.1), the template's default. Astro
      // downloads it from Google Fonts at build time and serves it with the
      // page, so no font files live in the repository.
      provider: fontProviders.google(),
      name: "Noto Sans",
      cssVariable: "--font-noto-sans",
      weights: ["100 900"],
    },
  ],
  image: {
    responsiveStyles: true,
  },
});
