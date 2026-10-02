export interface PaletteColor {
  id: string;
  name: string;
  value: string; // #rrggbb
}

export const PALETTE_STORAGE_KEY = "delta2corel_Palette";

// Replace with your existing preset list if it differs
export const DEFAULT_PALETTE: PaletteColor[] = [
  { id: "p0", name: "Стандартний", value: "#92B4EC" },
  { id: "p1", name: "1 батальйон", value: "#fecc00" },
  { id: "p2", name: "2 батальйон", value: "#834e98" },
  { id: "p3", name: "3 батальйон", value: "#009846" },
  { id: "p4", name: "4 батальйон", value: "#a76281" },
  { id: "p5", name: "5 батальйон", value: "#7690c9" },
  { id: "p6", name: "Суміжники 1", value: "#a8d4af" },
  { id: "p7", name: "Суміжники 2", value: "#ef7f1a" },
  { id: "p8", name: "Суміжники 3", value: "#f5b2b6" },
  { id: "p9", name: "Суміжники 4", value: "#92b4ec" },
  { id: "p10", name: "Розмежувальні 1", value: "#92b4ec" },
  { id: "p11", name: "Розмежувальні 2", value: "#83fe93" },
  { id: "p12", name: "Район 1", value: "#c58025" },
  { id: "p13", name: "Район 2", value: "#c94e59" },
  { id: "p14", name: "Район 3", value: "#1d0be8" },
];

export function loadPalette(): PaletteColor[] {
  try {
    const saved = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        Array.isArray(parsed) &&
        parsed.every(
          (c) =>
            c &&
            typeof c.id === "string" &&
            typeof c.name === "string" &&
            /^#[0-9a-f]{6}$/i.test(c.value),
        )
      ) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to read delta2corel_Palette from localStorage", e);
  }
  return DEFAULT_PALETTE;
}

export function savePalette(palette: PaletteColor[]) {
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(palette));
  } catch (e) {
    console.error("Failed to save delta2corel_Palette", e);
  }
}
