import type { NextConfig } from "next";

// GitHub Pages serves from a subpath: https://USERNAME.github.io/REPO_NAME/
// Replace "Material-Analyzer-Pro" below if your repo name is different.
const GITHUB_REPO = "Material-Analyzer-Pro";

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  // Static export — generates HTML/JS/CSS in ./out/ for GitHub Pages
  output: "export",

  // GitHub Pages serves from /REPO_NAME/, not /
  basePath: isGitHubActions ? `/${GITHUB_REPO}` : "",
  assetPrefix: isGitHubActions ? `/${GITHUB_REPO}/` : undefined,

  // Required for static export — no server-side image optimization
  images: {
    unoptimized: true,
  },

  // Strict config — non-negotiable
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,

  // Trailing slash so GitHub Pages serves index.html correctly
  trailingSlash: true,
};

export default nextConfig;
