import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

// Import .css files as minified strings (used for Swiper's stylesheet,
// which is injected into the card's shadow root).
const cssString = () => ({
  name: "css-string",
  transform(code, id) {
    if (!id.endsWith(".css")) return null;
    const min = code
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([{}:;,>])\s*/g, "$1")
      .trim();
    return { code: `export default ${JSON.stringify(min)};`, map: null };
  },
});

export default {
  input: "src/index.js",
  output: {
    file: "dist/swipe-card.js",
    format: "es",
    inlineDynamicImports: true,
  },
  plugins: [
    resolve({ browser: true }),
    cssString(),
    terser({ format: { comments: false } }),
  ],
};
