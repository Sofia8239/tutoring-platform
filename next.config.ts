import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Puppeteer spawns a real Chromium and must not be bundled — load it via
  // native `require` in the PDF Route Handlers.
  serverExternalPackages: ["puppeteer"],
  experimental: {
    // Whiteboard autosave POSTs a tldraw snapshot as a Server Action payload;
    // the default 1MB cap is too small for a busy board. App-level limit lives
    // in `src/lib/whiteboard-scene.ts` (MAX_SCENE_BYTES).
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
