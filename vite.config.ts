import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load env file based on the current mode (development, production, etc.)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // ✅ This securely and correctly formats your env values without crashing
      "process.env": JSON.stringify(env),
    },
  };
});
