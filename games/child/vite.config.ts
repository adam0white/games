import { defineConfig } from "vite";
export default defineConfig({
  base: "/child/",
  build: {
    rolldownOptions: {
      input: { main: "index.html", file: "file/index.html" },
    },
    target: "es2023",
  },
  server: { port: 5179, strictPort: true },
});
