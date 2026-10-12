const CONFIG_BG_COLORS = {
  CLASSIC_BLUE: "#92B4EC",
  NOT_CAPABLE: "#e31e24",
};

import type { CsvRow } from "./csv";
import type { Point, XY } from "./geo";
import { mappingSVGs } from "./icons";
import { type LabelLayout, labelBuilder } from "./label-builder";
import {
  type AreaType,
  type LineType,
  typesOfAreas,
  typesOfLines,
} from "./lines";
import {
  CombatEffectiveness,
  IdentificationStatus,
  parseCombatEffectiveness,
  parseStandardIdentity,
} from "./types";
import type { BoundingBox, Rect } from "./utils";
import {
  boundingBoxesOverlap,
  computeBoundingBox,
  rectsOverlap,
} from "./utils";

export interface MapObjectLayout {
  pt: Point;
  idx: number;
  anchorPoint: { x: number; y: number };
  renderPoint?: { x: number; y: number };
  mappingIdx: number;
  ptApp6dType: string;
  parts: Rect[];
  bbox: BoundingBox;
  status: "idle" | "displaced" | "conflict";
  iconDetails?: {
    iconW: number;
    iconH: number;
    xPos: number;
    yPos: number;
    labels: LabelLayout[];
    damageOverlay?: "destroyed" | "damaged";
  };
  circleDetails?: {
    cleanText: string;
  };
  isExcluded?: boolean;
  hasSpecificIcon: boolean;
  overlayName: string;
}

export const objectsToExclude = [
  "Підземне укриття",
  "Вибух",
  "Автомобіль (вантажний або легковий)",
  "Мотоцикл",
  "Споруда",
  "Схованка",
];

export function filterMapObjectsInsideWindow(
  csvData: CsvRow[],
  project: (mgrs: string) => XY | null,
  inWindow: (p: XY) => boolean,
  projectWgs?: (lat: number, lng: number) => XY | null,
): Point[] {
  const points: Point[] = [];

  for (const row of csvData) {
    const app6dType = row["app6d type"]?.trim() || "";
    if (
      typesOfLines[app6dType as LineType] ||
      typesOfAreas[app6dType as AreaType]
    )
      continue;

    // Cheapest checks first: skip everything else if the row is off the map.
    const mgrsStr = row["coordinates(mgrs)"]?.trim() || "";
    const wgsRaw = row["coordinates(wgs,yx)"]?.trim() || "";

    let anchor: XY | null = null;
    let resolvedMgrsStr = mgrsStr;

    if (mgrsStr) {
      anchor = project(mgrsStr);
    }

    // Fallback to WGS84 first point when MGRS is absent or failed
    if (!anchor && projectWgs && wgsRaw) {
      const firstPair = wgsRaw.split(";")[0]?.trim();
      if (firstPair) {
        const [latStr, lngStr] = firstPair.split(",");
        const lat = parseFloat(latStr ?? "");
        const lng = parseFloat(lngStr ?? "");
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          anchor = projectWgs(lat, lng);
          // Use WGS pair as the mgrsStr label so it's not blank
          if (anchor) resolvedMgrsStr = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        }
      }
    }

    if (!anchor || !inWindow(anchor)) continue;

    points.push({
      mgrsStr: resolvedMgrsStr,
      anchor,
      app6dType,
      sidc: row["app6d sidc"]?.trim() || "",
      count: row["objects count"]?.trim() || "",
      name: row.name?.trim() || "",
      desc: row["object creator"]?.trim() || "",
      isHQ:
        (row["Штаб / тактична група / індикатор хибності"]?.trim() || "") ===
        "Штаб",
      higherFrmation: row["Вище формування"]?.trim() || "",
      comments: row.comments?.trim() || "",
      echelon: row.Ешелон?.trim() || "",
      objectId: row["object id"]?.trim() || "",
      overlayName: row["overlay name"]?.trim() || "Default Overlay",
      identificationStatus:
        parseStandardIdentity(row.Ідентифікація?.trim() || "") ??
        IdentificationStatus.Unknown,
      combatEffectiveness:
        parseCombatEffectiveness(row["status of presence"]?.trim() || "") ??
        CombatEffectiveness.FullyCapable,
    });
  }

  return points;
}

export function buildMapObjects(
  csvData: CsvRow[],
  iconRenderedSizes: { width: number; height: number }[],
  project: (mgrs: string) => XY | null,
  inWindow: (p: XY) => boolean,
  layerColors: Record<string, string> = {},
  projectWgs?: (lat: number, lng: number) => XY | null,
) {
  const points = filterMapObjectsInsideWindow(
    csvData,
    project,
    inWindow,
    projectWgs,
  );

  // 1. Calculate bounding polygon / rectangles for each element
  const preparedElements: MapObjectLayout[] = points.map((pt, idx) => {
    const anchorPoint = pt.anchor; // was geoToSvg(pt)
    const ptApp6dType = pt.app6dType ?? "";
    const isExcluded = objectsToExclude.includes(ptApp6dType);

    if (isExcluded) {
      return {
        pt,
        idx,
        anchorPoint,
        mappingIdx: -1,
        ptApp6dType,
        parts: [],
        bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        status: "idle",
        isExcluded: true,
        hasSpecificIcon: false,
        overlayName: pt.overlayName ?? "Default Overlay",
      };
    }

    const isEnemy = pt.identificationStatus === IdentificationStatus.Hostile;
    const isHQ = pt.isHQ;
    const status = pt.combatEffectiveness;
    const overlayName = pt.overlayName ?? "Default Overlay";
    const customBgColor = layerColors[overlayName];
    let leftLabelBgColor = customBgColor || CONFIG_BG_COLORS.CLASSIC_BLUE;
    let rightLabelBgColor = customBgColor || CONFIG_BG_COLORS.CLASSIC_BLUE;

    let mappingIdx = Object.keys(mappingSVGs).indexOf(ptApp6dType);

    const hasSpecificIcon = mappingIdx !== -1;

    if (isEnemy) {
      mappingIdx = 1;
    }

    const iconSize = iconRenderedSizes[mappingIdx === -1 ? 0 : mappingIdx] ?? {
      width: 8.0,
      height: 8.0,
    };

    const xPos = Number((anchorPoint.x - iconSize.width / 2).toFixed(3));
    const yPos = Number((anchorPoint.y - iconSize.height / 2).toFixed(3));

    let leftLabelText = "";
    let leftDescText = "";
    let rightLabelText = "";
    let rightDescText = "";
    let bottomLabelText = "";
    let bottomDescText = "";
    let topLabelText = "";

    if (pt.name) {
      leftLabelText = pt.name;
    } else {
      leftLabelText = "Left Label";
    }

    if (pt.higherFrmation) {
      rightLabelText = pt.higherFrmation;
    }

    if (pt.app6dType === "Піхотний підрозділ") {
      if (pt.echelon === "Батальйон / дивізіон") {
        topLabelText = "II";
      } else if (pt.echelon === "Рота / батарея") {
        topLabelText = "I";
      } else {
        topLabelText = "Ø";
      }
    }
    // else if (){
    //   topLabelText = 'ø';
    // }

    if (pt.count) {
      const countNum = pt.count;
      const rifleType = pt.comments?.toLowerCase().includes("colt")
        ? "ColtM4A1"
        : "AK74";
      leftDescText =
        rifleType && countNum
          ? `${rifleType}-${countNum}од`
          : "XXXXXXXXXXXXX од.";
      leftDescText;
    }

    if (pt.isHQ) {
      bottomLabelText = pt.name ?? "";
      bottomDescText = leftDescText;
      //rightLabelText = '';
      rightDescText = "";
      leftLabelText = "";
      leftDescText = "";
    }

    if (ptApp6dType === "Стик (між частинами та підрозділами)") {
      bottomLabelText = pt.name ?? "";
      rightLabelText = "";
      rightDescText = "";
      leftLabelText = "";
      leftDescText = "";
    }

    if (mappingIdx === -1) {
      bottomLabelText = pt.name ?? "";
      bottomDescText = `Error - ${pt.app6dType}`;
      rightLabelText = "";
      rightDescText = "";
      leftLabelText = "";
      leftDescText = "";
    }

    if (isEnemy) {
      bottomLabelText = "";
      bottomDescText = "";
      rightDescText = "";
      leftLabelText = "";
      leftDescText = "";
      console.log("!!!!!!");
    }

    let damageOverlay: "destroyed" | "damaged" | undefined;
    if (status === CombatEffectiveness.NotCapable) {
      console.log(" combatEffectiveness.NotCapable");
      topLabelText = "";
      leftLabelBgColor = CONFIG_BG_COLORS.NOT_CAPABLE;
      rightLabelBgColor = CONFIG_BG_COLORS.NOT_CAPABLE;
      leftDescText = "Знищено 06.09.2026";
      damageOverlay = "destroyed";
    } else if (status === CombatEffectiveness.PartiallyCapable) {
      damageOverlay = "damaged";
    }

    //const margin = 0.5;
    const xIconLeft = anchorPoint.x - iconSize.width / 2;
    const xIconRight = anchorPoint.x + iconSize.width / 2 - 0.1;
    const xIconCenter = anchorPoint.x;
    const yIconTop = anchorPoint.y - iconSize.height / 2;
    const yIconBottom = anchorPoint.y + iconSize.height / 2 - 0.2;

    const rightLabel = labelBuilder(
      rightLabelText,
      [xIconRight, yIconBottom],
      "start",
      "up",
      "md",
      rightLabelBgColor,
    );

    const leftLabel = labelBuilder(
      leftLabelText,
      [xIconLeft, yIconBottom],
      "end",
      "up",
      "md",
      leftLabelBgColor,
    );

    // leftDesc sits below the leftLabel rect, centered on it
    const leftLabelBottomCenterAnchor = {
      x: leftLabel.rectX + leftLabel.rectW / 2,
      y: leftLabel.rectY + leftLabel.rectH,
    };

    const leftDesc = labelBuilder(
      leftDescText,
      [leftLabelBottomCenterAnchor.x, leftLabelBottomCenterAnchor.y],
      "middle",
      "down",
      "sm",
    );

    const topLabel = labelBuilder(
      topLabelText,
      [xIconCenter, yIconTop - 0.5],
      "middle",
      "up",
      "sm",
      "none",
      "normal",
    );

    const bottomLabel = labelBuilder(
      bottomLabelText,
      isHQ ? [xIconLeft, yIconBottom] : [xIconCenter, yIconBottom],
      isHQ ? "start" : "middle",
      "down",
      "md",
    );

    const bottomLabelAnchor = {
      x: bottomLabel.rectX,
      y: bottomLabel.rectY + bottomLabel.rectH,
    };

    const bottomDesc = labelBuilder(
      bottomDescText,
      [bottomLabelAnchor.x, bottomLabelAnchor.y],
      isHQ ? "start" : "middle",
      "down",
      "sm",
    );

    const labels: LabelLayout[] = [
      leftLabel,
      leftDesc,
      rightLabel,
      bottomLabel,
      bottomDesc,
      topLabel,
    ].filter((l) => l.cleanText !== "");

    const iconRect: Rect = {
      x: xPos,
      y: yPos,
      width: iconSize.width,
      height: iconSize.height,
    };
    const parts: Rect[] = [iconRect];

    const addLabelRect = (label: {
      cleanText: string;
      rectX: number;
      rectY: number;
      rectW: number;
      rectH: number;
    }) => {
      if (label.cleanText) {
        parts.push({
          x: label.rectX,
          y: label.rectY,
          width: label.rectW,
          height: label.rectH,
        });
      }
    };
    labels.forEach(addLabelRect);

    console.log(rightDescText);

    const bbox = computeBoundingBox(parts);

    return {
      pt,
      idx,
      anchorPoint,
      mappingIdx,
      ptApp6dType,
      parts,
      bbox,
      status: "idle",
      hasSpecificIcon,
      overlayName: pt.overlayName ?? "Default Overlay",
      iconDetails: {
        iconW: iconSize.width,
        iconH: iconSize.height,
        xPos,
        yPos,
        labels,
        damageOverlay,
      },
    };
  });

  for (let i = 0; i < preparedElements.length; i++) {
    const elA = preparedElements[i];
    for (let j = i + 1; j < preparedElements.length; j++) {
      const elB = preparedElements[j];
      if (boundingBoxesOverlap(elA.bbox, elB.bbox)) {
        const partsOverlap = elA.parts.some((pA) =>
          elB.parts.some((pB) => rectsOverlap(pA, pB)),
        );
        if (partsOverlap) {
          let priorityA = mappingSVGs[elA.ptApp6dType]?.priority ?? 0;
          let priorityB = mappingSVGs[elB.ptApp6dType]?.priority ?? 0;

          if (elA.pt.isHQ) priorityA -= 1;
          if (elB.pt.isHQ) priorityB -= 1;

          if (priorityA === 10 && priorityB === 10) {
            elA.status = "conflict";
            elB.status = "conflict";
          } else if (priorityA > priorityB) {
            if (priorityB !== 10 && elB.status !== "conflict") {
              elB.status = "displaced";
            }
          } else if (priorityB > priorityA) {
            if (priorityA !== 10 && elA.status !== "conflict") {
              elA.status = "displaced";
            }
          } else {
            // Equal priority  < 10
            // Keep the first element (elA) in its original position and only displace the second (elB)
            if (priorityB !== 10 && elB.status !== "conflict") {
              elB.status = "displaced";
            }
          }
        }
      }
    }
  }

  return preparedElements;
}
