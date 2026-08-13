import coreWebVitals from "eslint-config-next/core-web-vitals"
import typescript from "eslint-config-next/typescript"

// `next lint` desapareció en Next 16: ESLint se invoca directo (script "lint")
// con los flat configs que eslint-config-next expone como subpaths.

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "node_modules/**", "src/lib/types/api.generated.ts"],
  },
]

export default eslintConfig
