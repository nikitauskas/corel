import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

// ─── Configuration ───────────────────────────────────────────────────────────

const SVG_INPUT = resolve(
	import.meta.dirname ?? ".",
	"../sample/Значки версія 17 140 наказ всі.svg",
);
const ICONS_OUTPUT_DIR = resolve(import.meta.dirname ?? ".", "../icons");

// Padding (in SVG user units) added around each extracted icon's bounding box
const VIEWBOX_PADDING = 50;

// ─── Types ───────────────────────────────────────────────────────────────────

interface BBox {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

interface ChildGroup {
	id: string;
	content: string; // raw inner SVG markup of the <g>...</g>
}

interface ParentGroup {
	id: string;
	children: ChildGroup[];
}

// ─── Helpers: decode CorelDRAW x-encoded IDs ─────────────────────────────────

/**
 * Decode CorelDRAW's `_xHHHH_` encoding in IDs back to real characters.
 * e.g. `_x0020_` → ` `, `_x002c_` → `,`, `_x0027_` → `'`
 */
function decodeCorelId(raw: string): string {
	return raw.replace(/_x([0-9a-fA-F]{4})_/g, (_, hex) =>
		String.fromCharCode(Number.parseInt(hex, 16)),
	);
}

/**
 * Sanitise a decoded ID so it can be used as a folder / file name.
 * Replaces characters illegal in most file-systems with underscores,
 * collapses runs of underscores, and trims.
 */
function sanitiseName(decoded: string): string {
	return decoded
		.replace(/[<>:"/\\|?*,.'()]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "")
		.trim();
}

// ─── Helpers: bounding-box calculation from raw SVG content ──────────────────

/** Parse a single numeric value, handling scientific notation. */
function num(s: string): number {
	return Number.parseFloat(s);
}

/**
 * Merge a new point (or box) into an existing bbox.
 */
function expandBBox(bbox: BBox, x: number, y: number): void {
	if (x < bbox.minX) bbox.minX = x;
	if (x > bbox.maxX) bbox.maxX = x;
	if (y < bbox.minY) bbox.minY = y;
	if (y > bbox.maxY) bbox.maxY = y;
}

function mergeBBox(target: BBox, source: BBox): void {
	if (source.minX < target.minX) target.minX = source.minX;
	if (source.minY < target.minY) target.minY = source.minY;
	if (source.maxX > target.maxX) target.maxX = source.maxX;
	if (source.maxY > target.maxY) target.maxY = source.maxY;
}

function emptyBBox(): BBox {
	return {
		minX: Number.POSITIVE_INFINITY,
		minY: Number.POSITIVE_INFINITY,
		maxX: Number.NEGATIVE_INFINITY,
		maxY: Number.NEGATIVE_INFINITY,
	};
}

function bboxIsValid(b: BBox): boolean {
	return (
		Number.isFinite(b.minX) &&
		Number.isFinite(b.minY) &&
		Number.isFinite(b.maxX) &&
		Number.isFinite(b.maxY)
	);
}

// ─── Numeric coordinate regex building blocks ────────────────────────────────

// Matches a floating point number (incl. optional sign and scientific notation)
const NUM_RE_STR = "-?[\\d]*\\.?[\\d]+(?:[eE][+-]?\\d+)?";
const NUM_RE = new RegExp(NUM_RE_STR, "g");

/**
 * Extract the bounding box of all visual SVG elements in the given markup.
 *
 * Strategy: scan for every numeric coordinate pair that appears in known
 * SVG attributes (`x`, `y`, `x1`, `y1`, `cx`, `cy`, `width`, `height`,
 * `points`, `d`, `viewBox`, `transform`).  This is intentionally a rough
 * geometric bound – it's good enough for setting a viewBox and far simpler
 * than a full SVG DOM implementation.
 */
function computeBBox(svgContent: string): BBox {
	const bbox = emptyBBox();

	// --- <rect> ---
	const rectRe =
		/<rect[^>]*?\bx\s*=\s*"([^"]+)"[^>]*?\by\s*=\s*"([^"]+)"[^>]*?\bwidth\s*=\s*"([^"]+)"[^>]*?\bheight\s*=\s*"([^"]+)"/g;
	for (const m of svgContent.matchAll(rectRe)) {
		const x = num(m[1]);
		const y = num(m[2]);
		const w = num(m[3]);
		const h = num(m[4]);
		expandBBox(bbox, x, y);
		expandBBox(bbox, x + w, y + h);
	}
	// rect attributes in a different order – also try permutation-agnostic approach
	const rectRe2 =
		/<rect\b[^>]*?>/g;
	for (const m of svgContent.matchAll(rectRe2)) {
		const tag = m[0];
		const xm = tag.match(/\bx\s*=\s*"([^"]+)"/);
		const ym = tag.match(/\by\s*=\s*"([^"]+)"/);
		const wm = tag.match(/\bwidth\s*=\s*"([^"]+)"/);
		const hm = tag.match(/\bheight\s*=\s*"([^"]+)"/);
		if (xm && ym && wm && hm) {
			const x = num(xm[1]);
			const y = num(ym[1]);
			const w = num(wm[1]);
			const h = num(hm[1]);
			expandBBox(bbox, x, y);
			expandBBox(bbox, x + w, y + h);
		}
	}

	// --- <circle> ---
	const circleRe = /<circle\b[^>]*?>/g;
	for (const m of svgContent.matchAll(circleRe)) {
		const tag = m[0];
		const cxm = tag.match(/\bcx\s*=\s*"([^"]+)"/);
		const cym = tag.match(/\bcy\s*=\s*"([^"]+)"/);
		const rm = tag.match(/\br\s*=\s*"([^"]+)"/);
		if (cxm && cym && rm) {
			const cx = num(cxm[1]);
			const cy = num(cym[1]);
			const r = num(rm[1]);
			expandBBox(bbox, cx - r, cy - r);
			expandBBox(bbox, cx + r, cy + r);
		}
	}

	// --- <ellipse> ---
	const ellipseRe = /<ellipse\b[^>]*?>/g;
	for (const m of svgContent.matchAll(ellipseRe)) {
		const tag = m[0];
		const cxm = tag.match(/\bcx\s*=\s*"([^"]+)"/);
		const cym = tag.match(/\bcy\s*=\s*"([^"]+)"/);
		const rxm = tag.match(/\brx\s*=\s*"([^"]+)"/);
		const rym = tag.match(/\bry\s*=\s*"([^"]+)"/);
		if (cxm && cym && rxm && rym) {
			const cx = num(cxm[1]);
			const cy = num(cym[1]);
			const rx = num(rxm[1]);
			const ry = num(rym[1]);
			expandBBox(bbox, cx - rx, cy - ry);
			expandBBox(bbox, cx + rx, cy + ry);
		}
	}

	// --- <line> ---
	const lineRe = /<line\b[^>]*?>/g;
	for (const m of svgContent.matchAll(lineRe)) {
		const tag = m[0];
		const x1m = tag.match(/\bx1\s*=\s*"([^"]+)"/);
		const y1m = tag.match(/\by1\s*=\s*"([^"]+)"/);
		const x2m = tag.match(/\bx2\s*=\s*"([^"]+)"/);
		const y2m = tag.match(/\by2\s*=\s*"([^"]+)"/);
		if (x1m && y1m && x2m && y2m) {
			expandBBox(bbox, num(x1m[1]), num(y1m[1]));
			expandBBox(bbox, num(x2m[1]), num(y2m[1]));
		}
	}

	// --- <text> (just the anchor point; width approximation is difficult) ---
	const textRe = /<text\b[^>]*?>/g;
	for (const m of svgContent.matchAll(textRe)) {
		const tag = m[0];
		const xm = tag.match(/\bx\s*=\s*"([^"]+)"/);
		const ym = tag.match(/\by\s*=\s*"([^"]+)"/);
		if (xm && ym) {
			// Text goes upward from y (baseline) and to the right from x.
			// Add a generous margin for the glyph extents.
			const x = num(xm[1]);
			const y = num(ym[1]);
			expandBBox(bbox, x, y - 400); // approx ascent
			expandBBox(bbox, x + 800, y + 100); // approx width/descent
		}
	}

	// --- <polygon> / <polyline> points attribute ---
	const polyRe = /<poly(?:gon|line)\b[^>]*?\bpoints\s*=\s*"([^"]+)"/g;
	for (const m of svgContent.matchAll(polyRe)) {
		const nums = m[1].match(NUM_RE);
		if (nums) {
			for (let i = 0; i + 1 < nums.length; i += 2) {
				expandBBox(bbox, num(nums[i]), num(nums[i + 1]));
			}
		}
	}

	// --- <path d="..."> – extract all numeric coordinate pairs from d attribute ---
	const pathDRe = /\bd\s*=\s*"([^"]+)"/g;
	for (const m of svgContent.matchAll(pathDRe)) {
		const d = m[1];
		extractPathBBox(d, bbox);
	}

	return bbox;
}

/**
 * Very rough path-data bbox: tokenize the `d` attribute and pull out every
 * pair of consecutive numbers that looks like an absolute coordinate.
 *
 * This ignores relative commands, arcs parameters, etc., but since the
 * CorelDRAW export almost exclusively uses absolute coords it works well
 * enough for setting the viewBox.
 */
function extractPathBBox(d: string, bbox: BBox): void {
	// Tokenise: split into commands and numbers
	const tokenRe = /([a-zA-Z])|(-?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
	let match: RegExpExecArray | null;
	let currentCmd = "";
	const numbers: number[] = [];

	const flush = () => {
		if (numbers.length < 2) {
			numbers.length = 0;
			return;
		}

		const isAbsolute = currentCmd === currentCmd.toUpperCase();

		switch (currentCmd.toUpperCase()) {
			case "M":
			case "L":
			case "T":
				// pairs of (x, y)
				if (isAbsolute) {
					for (let i = 0; i + 1 < numbers.length; i += 2) {
						expandBBox(bbox, numbers[i], numbers[i + 1]);
					}
				}
				break;
			case "C":
				// triples of (x,y) control/end points
				if (isAbsolute) {
					for (let i = 0; i + 1 < numbers.length; i += 2) {
						expandBBox(bbox, numbers[i], numbers[i + 1]);
					}
				}
				break;
			case "S":
			case "Q":
				if (isAbsolute) {
					for (let i = 0; i + 1 < numbers.length; i += 2) {
						expandBBox(bbox, numbers[i], numbers[i + 1]);
					}
				}
				break;
			case "H":
				if (isAbsolute) {
					for (const n of numbers) expandBBox(bbox, n, bbox.minY);
				}
				break;
			case "V":
				if (isAbsolute) {
					for (const n of numbers) expandBBox(bbox, bbox.minX, n);
				}
				break;
			case "A":
				// arc: rx ry rotation large-arc sweep x y
				if (isAbsolute && numbers.length >= 7) {
					for (let i = 0; i + 6 < numbers.length; i += 7) {
						expandBBox(bbox, numbers[i + 5], numbers[i + 6]);
					}
				}
				break;
		}

		numbers.length = 0;
	};

	while ((match = tokenRe.exec(d)) !== null) {
		if (match[1]) {
			// It's a command letter
			flush();
			currentCmd = match[1];
		} else if (match[2]) {
			numbers.push(num(match[2]));
		}
	}
	flush();
}

// ─── Helpers: extract transform-based coordinates ────────────────────────────

/**
 * Expand the bbox with transform="matrix(a,b,c,d,e,f)" tx/ty translations
 * that appear on elements.  This helps catch elements positioned via transforms
 * rather than explicit x/y attributes.
 */
function expandBBoxWithTransforms(content: string, bbox: BBox): void {
	const matrixRe =
		/transform\s*=\s*"matrix\(([^)]+)\)"/g;
	for (const m of content.matchAll(matrixRe)) {
		const parts = m[1].split(/[\s,]+/).map(num);
		if (parts.length >= 6) {
			const tx = parts[4];
			const ty = parts[5];
			expandBBox(bbox, tx, ty);
		}
	}
}

// ─── SVG assembly ────────────────────────────────────────────────────────────

/**
 * Build a standalone SVG string from the extracted child content.
 * Re-roots the coordinate system so that the icon's bounding box starts at
 * (0, 0) with the given padding.
 */
function buildSvg(
	innerContent: string,
	bbox: BBox,
	defs: string,
	padding: number,
): string {
	const vbX = bbox.minX - padding;
	const vbY = bbox.minY - padding;
	const vbW = bbox.maxX - bbox.minX + 2 * padding;
	const vbH = bbox.maxY - bbox.minY + 2 * padding;

	// Use a reasonable default pixel size (clamp to max 800px on longest side)
	const maxDim = 800;
	const scale = Math.min(maxDim / vbW, maxDim / vbH, 1);
	const width = Math.round(vbW * scale);
	const height = Math.round(vbH * scale);

	return [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
		`  width="${width}" height="${height}"`,
		`  viewBox="${vbX} ${vbY} ${vbW} ${vbH}"`,
		`  style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd">`,
		`  <defs>`,
		defs,
		`  </defs>`,
		innerContent,
		`</svg>`,
	].join("\n");
}

// ─── Parsing: extract parent and child groups from the SVG ───────────────────

/**
 * Parse the SVG file and extract the two-level group hierarchy.
 *
 * Parent groups: direct children of <svg> that are `<g id="...">` (1-space indent).
 * Child groups: direct children of parent groups that are `<g id="...">` (2-space indent).
 *
 * We rely on the consistent indentation from the CorelDRAW export rather than
 * full XML parsing, which lets us handle the 800KB+ file efficiently and
 * preserve the original markup verbatim.
 */
function parseGroups(svgText: string): {
	parents: ParentGroup[];
	defs: string;
} {
	const lines = svgText.split(/\r?\n/);

	// ── Extract only <style> and <clipPath> from <defs> (skip font glyph data) ──
	let defs = "";
	{
		const defsStart = lines.findIndex((l) => l.trimStart().startsWith("<defs"));
		const defsEnd = lines.findIndex((l) => l.trimStart().startsWith("</defs>"));
		if (defsStart >= 0 && defsEnd >= 0) {
			const defsContent = lines.slice(defsStart + 1, defsEnd).join("\n");

			// Extract <style>…</style> block
			const styleMatch = defsContent.match(/(<style[\s\S]*?<\/style>)/i);
			const styleBlock = styleMatch ? styleMatch[1] : "";

			// Extract all <clipPath>…</clipPath> blocks
			const clipPaths: string[] = [];
			const clipRe = /<clipPath[\s\S]*?<\/clipPath>/gi;
			for (const cm of defsContent.matchAll(clipRe)) {
				clipPaths.push(cm[0]);
			}

			defs = [styleBlock, ...clipPaths].filter(Boolean).join("\n");
		}
	}

	// ── Walk lines to detect parent and child groups ──
	const parents: ParentGroup[] = [];
	let currentParent: ParentGroup | null = null;
	let insideChild = false;
	let childId = "";
	let childLines: string[] = [];
	let childDepth = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Detect parent group opening: exactly 1 leading space + `<g id="..."`
		const parentMatch = line.match(/^ <g\s+id="([^"]+)"/);
		if (parentMatch && !insideChild) {
			// Close previous parent if any
			if (currentParent) {
				parents.push(currentParent);
			}
			currentParent = {
				id: parentMatch[1],
				children: [],
			};
			continue;
		}

		// Detect parent group closing: exactly 1 leading space + `</g>`
		if (/^ <\/g>/.test(line) && currentParent && !insideChild) {
			parents.push(currentParent);
			currentParent = null;
			continue;
		}

		if (!currentParent) continue;

		// Detect child group opening: exactly 2 leading spaces + `<g id="..."`
		const childMatch = line.match(/^  <g\s+id="([^"]+)"/);
		if (childMatch && !insideChild) {
			insideChild = true;
			childId = childMatch[1];
			childLines = [line];
			childDepth = 1;
			continue;
		}

		if (insideChild) {
			childLines.push(line);

			// Count nested <g> / </g> to find the matching close
			const opens = (line.match(/<g[\s>]/g) || []).length;
			const closes = (line.match(/<\/g>/g) || []).length;
			childDepth += opens - closes;

			if (childDepth <= 0) {
				// Child group closed
				currentParent.children.push({
					id: childId,
					content: childLines.join("\n"),
				});
				insideChild = false;
				childLines = [];
				childId = "";
			}
			continue;
		}

		// Lines between children (like <metadata>) or standalone elements
		// that are direct children of the parent but NOT inside a <g id="...">
		// We could optionally capture these too, but the spec only asks for <g> children.
	}

	// Push last parent if file ends without explicit close
	if (currentParent) {
		parents.push(currentParent);
	}

	return { parents, defs };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
	console.log("📖 Reading SVG file…");
	const svgText = readFileSync(SVG_INPUT, "utf-8");
	console.log(`   File size: ${(svgText.length / 1024).toFixed(0)} KB`);

	console.log("🔍 Parsing group hierarchy…");
	const { parents, defs } = parseGroups(svgText);

	console.log(`   Found ${parents.length} parent groups`);

	let totalIcons = 0;
	let skipped = 0;

	for (const parent of parents) {
		const folderName = sanitiseName(decodeCorelId(parent.id));
		const folderPath = join(ICONS_OUTPUT_DIR, folderName);

		if (!existsSync(folderPath)) {
			mkdirSync(folderPath, { recursive: true });
		}

		console.log(
			`\n📁 ${folderName}/ (${parent.children.length} icons)`,
		);

		for (const child of parent.children) {
			const fileName = sanitiseName(decodeCorelId(child.id));

			// Compute bounding box of this child's content
			const bbox = computeBBox(child.content);
			expandBBoxWithTransforms(child.content, bbox);

			if (!bboxIsValid(bbox)) {
				console.log(`   ⚠️  Skipped "${fileName}" — could not compute bbox`);
				skipped++;
				continue;
			}

			const svg = buildSvg(child.content, bbox, defs, VIEWBOX_PADDING);
			const outPath = join(folderPath, `${fileName}.svg`);
			writeFileSync(outPath, svg, "utf-8");

			totalIcons++;
		}
	}

	console.log(`\n✅ Done! Extracted ${totalIcons} icons into ${parents.length} folders.`);
	if (skipped > 0) {
		console.log(`   ⚠️  ${skipped} icons skipped (no geometry found).`);
	}
}

main();
