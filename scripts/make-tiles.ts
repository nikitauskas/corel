import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { computeMercatorExtent } from "../src/lib/overlay-bounds";

/*

npx tsx scripts/make-tiles.ts \
  --input /Users/nikitos/Projects/Delta2Corel/misc/myrne/bg.jpg \
  --mgrs 37UBP9708043769 \
  --scale 25000 --dpi 300 \
  --min-zoom 8 --max-zoom 16

*/

const args: Record<string, string> = {};
process.argv.slice(2).forEach((a, i, arr) => {
  if (a.startsWith("--")) args[a.slice(2)] = arr[i + 1];
});

const input = args["input"];
const mgrs = args["mgrs"];
const scale = Number(args["scale"] ?? 25000);
const dpi = Number(args["dpi"] ?? 300);
const outDir = args["out"] ?? "public/tiles";
const TILE = 256;

if (!input || !mgrs) {
  console.error(
    "Usage: tsx scripts/make-tiles.ts --input map.jpg --mgrs 37UBP9708043769 " +
      "[--scale 25000 --dpi 300 --min-zoom N --max-zoom N --out public/tiles]",
  );
  process.exit(1);
}

sharp.cache(false);

const ORIGIN = 20037508.342789244;
const RES0 = (2 * ORIGIN) / TILE;

async function main() {
  const meta = await sharp(input, { limitInputPixels: false }).metadata();
  const srcW = meta.width!;
  const srcH = meta.height!;

  // pixels -> paper meters -> ground meters
  const widthM = (srcW / dpi) * 0.0254 * scale;
  const heightM = (srcH / dpi) * 0.0254 * scale;
  const ext = computeMercatorExtent(mgrs, widthM, heightM);
  const extW = ext.xMax - ext.xMin;
  const extH = ext.yMax - ext.yMin;

  console.log(
    `Source ${srcW}x${srcH}px @ ${dpi}dpi = ${(widthM / 1000).toFixed(2)} km`,
  );
  console.log("Decoding...");
  const { data, info } = await sharp(input, { limitInputPixels: false })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels as 3 | 4; // always use what the decoder returned
  console.log(`Decoded: ${info.width}x${info.height}, ${channels} channels`);

  const nativeZoom = Math.log2(RES0 / (extW / srcW));
  const maxZoom = Number(args["max-zoom"] ?? Math.ceil(nativeZoom));
  const minZoom = Number(args["min-zoom"] ?? Math.max(0, maxZoom - 3));
  console.log(
    `native zoom ≈ ${nativeZoom.toFixed(2)}, generating z${minZoom}..z${maxZoom}`,
  );

  const sx = srcW / extW;
  const sy = srcH / extH;

  for (let z = minZoom; z <= maxZoom; z++) {
    const size = (2 * ORIGIN) / 2 ** z;
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

          const ix0 = Math.max(tLeft, ext.xMin);
          const ix1 = Math.min(tLeft + size, ext.xMax);
          const iy0 = Math.max(tTop - size, ext.yMin);
          const iy1 = Math.min(tTop, ext.yMax);
          if (ix1 <= ix0 || iy1 <= iy0) return;

          const dLeft = Math.round(((ix0 - tLeft) / size) * TILE);
          const dRight = Math.round(((ix1 - tLeft) / size) * TILE);
          const dTop = Math.round(((tTop - iy1) / size) * TILE);
          const dBottom = Math.round(((tTop - iy0) / size) * TILE);
          const dW = dRight - dLeft;
          const dH = dBottom - dTop;
          if (dW < 1 || dH < 1) return;

          const sLeft = Math.max(0, Math.round((ix0 - ext.xMin) * sx));
          const sTop = Math.max(0, Math.round((ext.yMax - iy1) * sy));
          const sW = Math.min(
            srcW - sLeft,
            Math.max(1, Math.round((ix1 - ix0) * sx)),
          );
          const sH = Math.min(
            srcH - sTop,
            Math.max(1, Math.round((iy1 - iy0) * sy)),
          );

          const piece = await sharp(data, {
            limitInputPixels: false,
            raw: { width: srcW, height: srcH, channels },
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
              .png()
              .toFile(file);
          }
        });
      }
    }

    let i = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (i < jobs.length) await jobs[i++]();
      }),
    );
    console.log(`z${z}: ${jobs.length} tiles`);
  }

  console.log(`\nDone → ${outDir}`);
  console.log(
    `Component: tileMinZoom={${minZoom}} tileMaxZoom={${maxZoom}} widthPx={${srcW}} heightPx={${srcH}} dpi={${dpi}}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
