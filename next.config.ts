import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // The page's data loading does a live GraphQL fetch plus, per PR touching a module, a REST
  // Contents API call and CVE/CVSS/KEV lookups against OSV/NVD/CISA — comfortably over Next's
  // default 60s static-generation timeout on a real build against a large, active repo.
  staticPageGenerationTimeout: 300,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
