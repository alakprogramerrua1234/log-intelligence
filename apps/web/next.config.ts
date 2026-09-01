import type { NextConfig } from "next"
import path from "path"

// La demo estática las define (ver .github/workflows/deploy-demo.yml):
//   NEXT_OUTPUT_EXPORT=true  → sitio completamente estático en apps/web/out
//   NEXT_BASE_PATH=/repo     → servir desde una subruta (GitHub Pages)
// Sin ellas, dev y build de producción se comportan exactamente igual que antes.
const isExport = process.env.NEXT_OUTPUT_EXPORT === "true"
const basePath = process.env.NEXT_BASE_PATH ?? ""

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  ...(isExport
    ? {
        output: "export" as const,
        trailingSlash: true,      // /explore/ → explore/index.html en hosting estático
        images: { unoptimized: true },
      }
    : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
}

export default nextConfig
