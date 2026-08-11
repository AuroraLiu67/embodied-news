import type { NextConfig } from "next";

import { loadPublicConfig } from "./lib/config/public";

const { siteBasePath } = loadPublicConfig();

const nextConfig: NextConfig = {
  basePath: siteBasePath,
  output: "export",
};

export default nextConfig;
