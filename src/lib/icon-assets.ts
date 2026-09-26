// Auto-imported: all SVG icons in src/assets/icons2 bundled as raw strings (Vite import.meta.glob ?raw)
// This avoids fetch() which doesn't work on file:// protocol.

const svgModules = import.meta.glob<string>("../assets/icons2/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * Maps icon prefix name → raw SVG string.
 * Automatically populated from src/assets/icons2/*.svg
 */
export const ICON_RAW_SVGS: Record<string, string> = {};

for (const [path, content] of Object.entries(svgModules)) {
  const filename =
    path
      .split("/")
      .pop()
      ?.replace(/\.svg$/, "") || "";
  if (!filename) continue;

  ICON_RAW_SVGS[filename] = content;

  // Key alias for filename difference (e.g. '-' vs '/')
  if (filename === "Точка злету БпЛА вертикального зльоту - посадки") {
    ICON_RAW_SVGS["Точка злету БпЛА вертикального зльоту / посадки"] = content;
  }
  if (
    filename ===
    "Пункт проведення медичної евакуації (MEDEVAC) Пункт прийому о-с на борт"
  ) {
    ICON_RAW_SVGS[
      "Пункт проведення медичної евакуації (MEDEVAC) Пункт прийому о/с на борт"
    ] = content;
  }
}
