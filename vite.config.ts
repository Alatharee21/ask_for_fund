import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/sui-rpc": {
          target: "https://sui-testnet.gateway.tatum.io",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/sui-rpc/, ""),
          headers: {
            "x-api-key": env.VITE_TATUM_API_KEY || "",
          },
          configure: (proxy) => {
            // Strip headers that Tatum CORS policy blocks
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.removeHeader("client-sdk-version");
              proxyReq.removeHeader("client-sdk-type");
              proxyReq.removeHeader("client-target-api-version");
            });
          },
        },
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