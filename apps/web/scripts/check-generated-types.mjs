// Falla si `src/lib/types/api.generated.ts` no coincide con el OpenAPI actual.
//
// Es la puerta que hace real la regla de CLAUDE.md §8.5: si cambias un schema de
// Pydantic, los tipos del frontend cambian en el mismo PR. Sin esto, el contrato
// API ↔ web se desincroniza en silencio y el fallo aparece en runtime.

import { readGenerated, renderTypes } from "./generate-types.mjs"

const fresh = await renderTypes()
const committed = readGenerated()

if (fresh !== committed) {
  console.error(
    "\napi.generated.ts está desactualizado respecto a apps/api/openapi.json.\n" +
      "Ejecuta:\n" +
      "  uv run --directory apps/api python scripts/export_openapi.py\n" +
      "  pnpm --filter web generate:types\n",
  )
  process.exit(1)
}

console.log("api.generated.ts está al día.")
