import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { computeMercatorExtent } from "../src/lib/overlay-bounds";

// ---------- CLI ----------
const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const input = args["input"];
const mgrs = args["mgrs"];
const widthMm = Number(args["width-mm"] ?? 1810);
const heightMm = Number(args["height-mm"] ?? 1810);
const scale = Number(args["scale"] ?? 25000);
const outDir = args["out"] ?? "public/tiles";
const TILE = 256;

if (!input || !mgrs) {
  console.error(
    "Usage: tsx scripts/make-tiles.ts --input map.png --mgrs 36UXA1234567890 " +
      "[--width-mm 1810 --height-mm 1810 --scale 25000 --min-zoom N --max-zoom N --out public/tiles]",
  );
  process.exit(1);
}

// ---------- geometry ----------
const ORIGIN = 20037508.342789244; // half of Web Mercator world width
const RES0 = (2 * ORIGIN) / TILE; // meters per pixel at z0

const ext = computeMercatorExtent(
  mgrs,
  (widthMm * scale) / 1000,
  (heightMm * scale) / 1000,
);
const extW = ext.xMax - ext.xMin;
const extH = ext.yMax - ext.yMin;

async function main() {
  console.log("Decoding source image...");
  const { data, info } = await sharp(input, { limitInputPixels: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const srcW = info.width;
  const srcH = info.height;

  // zoom at which one tile pixel ~= one source pixel
  const nativeZoom = Math.log2(RES0 / (extW / srcW));
  const maxZoom = Number(args["max-zoom"] ?? Math.ceil(nativeZoom));
  const minZoom = Number(args["min-zoom"] ?? Math.max(0, maxZoom - 3));
  console.log(
    `Source ${srcW}x${srcH}px, native zoom ≈ ${nativeZoom.toFixed(2)}, generating z${minZoom}..z${maxZoom}`,
  );

  const sx = srcW / extW; // source px per mercator meter
  const sy = srcH / extH;

  for (let z = minZoom; z <= maxZoom; z++) {
    const size = (2 * ORIGIN) / 2 ** z; // tile size in mercator meters
    const x0 = Math.floor((ext.xMin + ORIGIN) / size);
    const x1 = Math.floor((ext.xMax + ORIGIN - 1e-6) / size);
    const y0 = Math.floor((ORIGIN - ext.yMax) / size);
    const y1 = Math.floor((ORIGIN - ext.yMin - 1e-6) / size);

    const jobs: (() => Promise<void>)[] = [];

    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        jobs.push(async () => {
          const tLeft = -ORIGIN + x * size;
          const tTop = ORIGIN - y * size;
          const tRight = tLeft + size;
          const tBottom = tTop - size;

          // intersection with overlay extent (mercator)
          const ix0 = Math.max(tLeft, ext.xMin);
          const ix1 = Math.min(tRight, ext.xMax);
          const iy0 = Math.max(tBottom, ext.yMin);
          const iy1 = Math.min(tTop, ext.yMax);
          if (ix1 <= ix0 || iy1 <= iy0) return;

          // destination rect inside the 256x256 tile
          const dLeft = Math.round(((ix0 - tLeft) / size) * TILE);
          const dRight = Math.round(((ix1 - tLeft) / size) * TILE);
          const dTop = Math.round(((tTop - iy1) / size) * TILE);
          const dBottom = Math.round(((tTop - iy0) / size) * TILE);
          const dW = dRight - dLeft;
          const dH = dBottom - dTop;
          if (dW < 1 || dH < 1) return;

          // source rect
          const sLeft = Math.max(0, Math.floor((ix0 - ext.xMin) * sx));
          const sTop = Math.max(0, Math.floor((ext.yMax - iy1) * sy));
          const sRight = Math.min(srcW, Math.ceil((ix1 - ext.xMin) * sx));
          const sBottom = Math.min(srcH, Math.ceil((ext.yMax - iy0) * sy));
          const sW = sRight - sLeft;
          const sH = sBottom - sTop;
          if (sW < 1 || sH < 1) return;

          const piece = await sharp(data, {
            limitInputPixels: false,
            raw: { width: srcW, height: srcH, channels: 3 }, // or 4 if you didn't apply the removeAlpha edit
          })
            .extract({ left: sLeft, top: sTop, width: sW, height: sH })
            .resize(dW, dH, { fit: "fill", kernel: "lanczos3" })
            .png()
            .toBuffer();

          const dir = path.join(outDir, String(z), String(x));
          fs.mkdirSync(dir, { recursive: true });
          const file = path.join(dir, `${y}.png`);

          if (dW === TILE && dH === TILE) {
            fs.writeFileSync(file, piece);
          } else {
            await sharp({
              create: {
                width: TILE,
                height: TILE,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
              },
            })
              .composite([{ input: piece, left: dLeft, top: dTop }])
              .png({ compressionLevel: 9 })
              .toFile(file);
          }
        });
      }
    }

    // small concurrency pool
    let i = 0;
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        while (i < jobs.length) await jobs[i++]();
      }),
    );
    console.log(`z${z}: ${jobs.length} tiles`);
  }

  console.log(`\nDone → ${outDir}`);
  console.log(`Use: tileMinZoom={${minZoom}} tileMaxZoom={${maxZoom}}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
