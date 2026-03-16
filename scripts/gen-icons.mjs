// Run: node scripts/gen-icons.mjs
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp not found — run: npm install sharp --save-dev");
  process.exit(1);
}

// Use favicon.ico as the source
const src = path.join(root, "app", "favicon.ico");
if (!existsSync(src)) {
  console.error("favicon.ico not found at", src);
  process.exit(1);
}

for (const size of [192, 512]) {
  const out = path.join(root, "public", "icons", `icon-${size}.png`);
  await sharp(src).resize(size, size, { fit: "contain", background: { r: 10, g: 10, b: 10, alpha: 1 } }).png().toFile(out);
  console.log(`✓ icon-${size}.png (from favicon.ico)`);
}
