// Genera `src/lib/types/api.generated.ts` desde el OpenAPI del backend.
//
// Se usa la API de Node de openapi-typescript en vez del CLI para que la
// generación y su verificación (check-generated-types.mjs) compartan
// exactamente el mismo código: si difirieran, el check podría fallar por una
// diferencia de formato en vez de por una deriva real del contrato.

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import openapiTS, { astToString } from "openapi-typescript"

const HERE = dirname(fileURLToPath(import.meta.url))

export const SCHEMA_PATH = resolve(HERE, "../../api/openapi.json")
export const OUTPUT_PATH = resolve(HERE, "../src/lib/types/api.generated.ts")

const BANNER = `/**
 * Generado desde apps/api/openapi.json. No editar a mano.
 *
 *   uv run --directory apps/api python scripts/export_openapi.py
 *   pnpm --filter web generate:types
 */

`

export async function renderTypes() {
  const ast = await openapiTS(pathToFileURL(SCHEMA_PATH))
  return BANNER + astToString(ast)
}

export function readGenerated() {
  return readFileSync(OUTPUT_PATH, "utf8")
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const contents = await renderTypes()
  writeFileSync(OUTPUT_PATH, contents, "utf8")
  console.log(`Escrito ${OUTPUT_PATH}`)
}
