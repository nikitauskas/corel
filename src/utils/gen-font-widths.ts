// scripts/gen-widths.ts  (npm i fontkit)
import * as fontkit from "fontkit";
import { writeFileSync } from "fs";

const upm = font.unitsPerEm; // usually 2048

const ranges: [number, number][] = [
  [0x20, 0x7e], // Basic Latin
  [0xa0, 0xff], // Latin-1
  [0x400, 0x4ff], // Cyrillic (includes Є І Ї Ґ)
  [0x2010, 0x2026], // dashes, quotes, ellipsis
  [0x2116, 0x2116], // №
];

const range = (from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) =>
    String.fromCodePoint(from + i),
  );

const GROUPS: { name: string; chars: string[] }[] = [
  { name: "space", chars: [" ", "\u00A0"] },
  { name: "digits", chars: range(0x30, 0x39) },
  {
    name: "ASCII punctuation",
    chars: [
      ...range(0x21, 0x2f),
      ...range(0x3a, 0x40),
      ...range(0x5b, 0x60),
      ...range(0x7b, 0x7e),
    ],
  },
  { name: "English uppercase", chars: range(0x41, 0x5a) },
  { name: "English lowercase", chars: range(0x61, 0x7a) },
  // Russian: А–Я (0410–042F) + Ё (0401), а–я (0430–044F) + ё (0451)
  { name: "Russian uppercase", chars: [...range(0x410, 0x42f), "Ё"] },
  { name: "Russian lowercase", chars: [...range(0x430, 0x44f), "ё"] },
  // Ukrainian-only letters (the rest are shared with Russian)
  { name: "Ukrainian uppercase", chars: ["Є", "І", "Ї", "Ґ"] },
  { name: "Ukrainian lowercase", chars: ["є", "і", "ї", "ґ"] },
  {
    name: "special symbols",
    chars: [
      "«",
      "»",
      "“",
      "”",
      "„",
      "‘",
      "’",
      "‚",
      "–",
      "—",
      "…",
      "•",
      "№",
      "©",
      "®",
      "™",
      "°",
      "±",
      "×",
      "÷",
      "§",
      "¶",
      "·",
      "€",
      "£",
      "¥",
      "¢",
    ],
  },
];

const out: Record<string, number> = {};
for (const [a, b] of ranges) {
  for (let cp = a; cp <= b; cp++) {
    const g = font.glyphForCodePoint(cp);
    if (!g || g.id === 0) continue;
    out[String.fromCodePoint(cp)] = Math.round((g.advanceWidth / upm) * 1000);
  }
}

writeFileSync(
  "./src/charWidths.ts",
  `export const CHAR_WIDTHS_1000: Record<string, number> = ${JSON.stringify(out, null, 2)};\n`,
);
