import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load env file based on the current mode (development, production, etc.)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      "process.env": JSON.stringify(env),
    },

    server: {
    proxy: {
      "/walrus-publisher": {
        target: "https://publisher.walrus-testnet.walrus.space",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/walrus-publisher/, ""),
      },
      "/walrus-aggregator": {
        target: "https://aggregator.walrus-testnet.walrus.space",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/walrus-aggregator/, ""),
      },
    },
  },
  };
});