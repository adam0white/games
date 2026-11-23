import { defineConfig } from "vite";
export default defineConfig({
  base: "/days/",
  build: { rolldownOptions: { input: { main: "index.html", file: "file/index.html" } } },
});
