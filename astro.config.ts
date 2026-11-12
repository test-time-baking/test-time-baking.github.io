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

// NVIDIA Sans is NVIDIA's corporate typeface. The font files are bundled from
// src/assets/fonts; see README.md before publishing the repository.
const fontDir = "./src/assets/fonts";
const nvidiaSans = (file: string, weight: number, style: "normal" | "italic" = "normal") => ({
  weight,
  style,
  src: [`${fontDir}/${file}`] as [string],
});

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
      provider: fontProviders.local(),
      name: "NVIDIA Sans",
      cssVariable: "--font-nvidia-sans",
      fallbacks: ["Inter", "Noto Sans", "system-ui", "sans-serif"],
      options: {
        variants: [
          nvidiaSans("NVIDIASans-Light.ttf", 300),
          nvidiaSans("NVIDIASans-Regular.ttf", 400),
          nvidiaSans("NVIDIASans-Medium.ttf", 500),
          nvidiaSans("NVIDIASans-Bold.ttf", 700),
          nvidiaSans("NVIDIASans-Italic.ttf", 400, "italic"),
        ],
      },
    },
  ],
  image: {
    responsiveStyles: true,
  },
});
