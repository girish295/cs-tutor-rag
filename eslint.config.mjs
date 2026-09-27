import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * Flat config. eslint-config-next v16 ships flat configs directly, so no
 * FlatCompat shim is needed.
 */
const config = [
  { ignores: [".next/**", "node_modules/**", "lib/rag/corpus.generated.ts"] },
  ...(Array.isArray(coreWebVitals) ? coreWebVitals : [coreWebVitals]),
  ...(Array.isArray(typescript) ? typescript : [typescript]),
];

export default config;
