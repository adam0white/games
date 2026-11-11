import { defineConfig } from "vite";
export default defineConfig({
  build: {
    target: "es2023",
    rolldownOptions: { output: { codeSplitting: false } },
  },
  server: { port: 5179, strictPort: true },
});
