import type { NextConfig } from "next";

/**
 * No custom configuration is needed.
 *
 * The knowledge base is compiled into a TypeScript module by
 * scripts/build-corpus.mjs, so nothing is read from disk at runtime and no
 * output-file tracing rules are required.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
