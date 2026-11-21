import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// To try local code against a deployed backend whose CORS blocks localhost, start Vite with PROXY_TARGET set to the
// backend URL, and put VITE_API_BASE_URL= (empty) in .env.local so the app calls its own origin.
// PROXY_TARGET is read through Vite's loadEnv (not `process`), so `tsc -b` needs no Node type definitions.
export default defineConfig(({ mode }) => {
  const target = loadEnv(mode, ".", "").PROXY_TARGET;
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, ...(target ? { proxy: { "/api": { target, changeOrigin: true } } } : {}) },
    test: { environment: "jsdom", globals: false },
  };
});
