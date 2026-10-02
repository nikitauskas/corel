export interface PaletteColor {
  id: string;
  name: string;
  value: string; // #rrggbb
}

export const PALETTE_STORAGE_KEY = "delta2corel_Palette";

// Replace with your existing preset list if it differs
export const DEFAULT_PALETTE: PaletteColor[] = [
  { id: "p1", name: "Yellow", value: "#fecc00" },
  { id: "p2", name: "Purple", value: "#834e98" },
  { id: "p3", name: "Green", value: "#009846" },
  { id: "p4", name: "Mauve", value: "#a76281" },
  { id: "p5", name: "Blue", value: "#7690c9" },
  { id: "p6", name: "Mint", value: "#a8d4af" },
  { id: "p7", name: "Orange", value: "#ef7f1a" },
  { id: "p8", name: "Pink", value: "#f5b2b6" },
  { id: "p9", name: "Light blue", value: "#92b4ec" },
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
