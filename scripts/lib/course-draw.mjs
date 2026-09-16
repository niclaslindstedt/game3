// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE-SCORING SCHEMATIC: one closed lap, stripped of scenery so the
// geometry a score is judging can be read at a glance. Curves are coloured
// by radius, checkpoint bars keep their course order, single-buoy checkpoints
// use the IJSBA left/red and right/yellow convention, ramps carry their whole clear
// corridor, and the sea's component bands point where their waves travel.

import {
  airCorridor,
  angleDiff,
  cumulative,
  distanceAlong,
  gatePassPoint,
  GATE_CORNER,
  pointAlong,
  polylineDistance,
  rulesAtPace,
} from "../../engine/index.ts";
import { createDrawing, textWidth } from "./draw.mjs";

const PAPER = [247, 245, 239];
const INK = [26, 28, 34];
const GRID = [160, 164, 170, 65];
const WATER = [222, 239, 243];
const CHECKPOINT = [34, 92, 170];
const START = [24, 156, 78];
const RAMP = [206, 42, 144];
const DETOUR = [154, 42, 124, 220];
const HAZARD = [86, 82, 76];
const LEFT = [218, 42, 38];
const RIGHT = [246, 190, 28];
const CURVE = {
  straight: [48, 112, 164],
  open: [35, 164, 102],
  working: [242, 150, 34],
  tight: [214, 48, 42],
};
const WAVE = {
  ocean: [20, 92, 166],
  local: [20, 162, 184],
  swell: [126, 70, 176],
};

const TITLE_H = 62;
const INFO_H = 440;
const MARGIN = 24;
const SAMPLE = 8;

function label(canvas, x, y, value, color = INK, scale = 1) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx || dy) canvas.text(value, x + dx, y + dy, PAPER, scale);
    }
  }
  canvas.text(value, x, y, color, scale);
}

function arrow(canvas, x, y, dx, dy, color, stroke = 2) {
  const length = Math.hypot(dx, dy);
  if (length < 2) return;
  const ux = dx / length;
  const uy = dy / length;
  const head = Math.min(11, length * 0.35);
  canvas.line(x, y, x + dx, y + dy, color, stroke);
  canvas.line(
    x + dx,
    y + dy,
    x + dx - ux * head + uy * head * 0.55,
    y + dy - uy * head - ux * head * 0.55,
    color,
    stroke,
  );
  canvas.line(
    x + dx,
    y + dy,
    x + dx - ux * head - uy * head * 0.55,
    y + dy - uy * head + ux * head * 0.55,
    color,
    stroke,
  );
}

function dashedLine(canvas, x0, y0, x1, y1, color, stroke = 1) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const pieces = Math.max(1, Math.floor(length / 8));
  for (let i = 0; i < pieces; i += 2) {
    const a = i / pieces;
    const b = Math.min(1, (i + 1) / pieces);
    canvas.line(
      x0 + (x1 - x0) * a,
      y0 + (y1 - y0) * a,
      x0 + (x1 - x0) * b,
      y0 + (y1 - y0) * b,
      color,
      stroke,
    );
  }
}

function lapStations(level) {
  const path = level.course.path;
  const cum = cumulative(path);
  const gates = level.course.gates;
  const stations = [];
  let after = 0;
  for (const gate of gates) {
    after = distanceAlong(path, cum, gate.x, gate.z, after);
    stations.push(after);
  }
  const from = stations[0] ?? 0;
  const to = stations[level.course.lapGates] ?? from;
  const points = [];
  for (let at = from; at < to; at += SAMPLE) points.push(pointAlong(path, cum, at));
  points.push(pointAlong(path, cum, to));
  return { points, stations, from, to };
}

function curveAt(points, index) {
  const count = points.length - 1;
  const a = points[(index - 2 + count) % count];
  const b = points[index % count];
  const c = points[(index + 2) % count];
  const h0 = Math.atan2(b.x - a.x, b.z - a.z);
  const h1 = Math.atan2(c.x - b.x, c.z - b.z);
  const turn = angleDiff(h1, h0);
  return { turn, radius: Math.abs(turn) < 1e-5 ? Infinity : (SAMPLE * 4) / Math.abs(turn) };
}

function courseBounds(level, points) {
  const places = points.map(({ x, z }) => ({ x, z }));
  places.push(level.start);
  for (const gate of level.course.gates.slice(0, level.course.lapGates)) {
    places.push(gate);
    if (gate.ramp) {
      const corridor = airCorridor(gate, level.pace);
      places.push({ x: corridor.x0, z: corridor.z0 }, { x: corridor.x1, z: corridor.z1 });
    }
  }
  for (const solid of level.solids) if (solid.kind === "buoy") places.push(solid);
  const xs = places.map((point) => point.x);
  const zs = places.map((point) => point.z);
  return {
    minX: Math.min(...xs) - 70,
    maxX: Math.max(...xs) + 70,
    minZ: Math.min(...zs) - 70,
    maxZ: Math.max(...zs) + 70,
  };
}

function drawRamp(canvas, gate, pace, px, py, scale) {
  const corridor = airCorridor(gate, pace);
  const dx = corridor.x1 - corridor.x0;
  const dz = corridor.z1 - corridor.z0;
  const length = Math.hypot(dx, dz);
  const rx = length > 0 ? (-dz / length) * corridor.halfWidth : 0;
  const rz = length > 0 ? (dx / length) * corridor.halfWidth : 0;
  const box = [
    [px(corridor.x0 + rx), py(corridor.z0 + rz)],
    [px(corridor.x1 + rx), py(corridor.z1 + rz)],
    [px(corridor.x1 - rx), py(corridor.z1 - rz)],
    [px(corridor.x0 - rx), py(corridor.z0 - rz)],
  ];
  canvas.poly(box, [RAMP[0], RAMP[1], RAMP[2], 28]);
  canvas.polyline(box, [RAMP[0], RAMP[1], RAMP[2], 125], 1, true);
  const ramp = gate.ramp;
  const lipX = ramp.x + Math.sin(ramp.heading) * ramp.length;
  const lipZ = ramp.z + Math.cos(ramp.heading) * ramp.length;
  arrow(
    canvas,
    px(ramp.x),
    py(ramp.z),
    px(lipX) - px(ramp.x),
    py(lipZ) - py(ramp.z),
    RAMP,
    Math.max(2, scale * 1.5),
  );
}

function nearestSample(points, target) {
  let nearest = points[0];
  let index = 0;
  let distance = Infinity;
  for (let i = 0; i < points.length; i++) {
    const candidate = Math.hypot(points[i].x - target.x, points[i].z - target.z);
    if (candidate >= distance) continue;
    nearest = points[i];
    index = i;
    distance = candidate;
  }
  return { point: nearest, index, distance };
}

function checkValue(score, metricId, checkId) {
  return score.metrics
    .find((metric) => metric.id === metricId)
    ?.checks.find((check) => check.id === checkId)?.value;
}

/** Draw the score-facing view of one closed course. */
export function renderCourseSchematic({ level, analysis, waveBands, size = 1120, title }) {
  const R = rulesAtPace(level.pace, level.rampWidth);
  const { points, from, to } = lapStations(level);
  const bounds = courseBounds(level, points);
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  const mapSize = size;
  const mapInner = mapSize - MARGIN * 2;
  const scale = Math.min(mapInner / spanX, mapInner / spanZ);
  const mapW = spanX * scale;
  const mapH = spanZ * scale;
  const width = mapSize;
  const height = TITLE_H + mapSize + INFO_H;
  const canvas = createDrawing(width, height, PAPER);
  const ox = MARGIN + (mapInner - mapW) / 2;
  const oy = TITLE_H + MARGIN + (mapInner - mapH) / 2;
  const px = (x) => ox + (x - bounds.minX) * scale;
  const py = (z) => oy + (bounds.maxZ - z) * scale;
  canvas.fillRect(MARGIN, TITLE_H + MARGIN, mapInner, mapInner, WATER);

  // A 100 m chart grid gives curve radii and start runs a scale the eye can
  // estimate without bringing the terrain back into the picture.
  const grid = 100;
  for (let x = Math.ceil(bounds.minX / grid) * grid; x <= bounds.maxX; x += grid) {
    canvas.line(px(x), oy, px(x), oy + mapH, GRID, 1);
  }
  for (let z = Math.ceil(bounds.minZ / grid) * grid; z <= bounds.maxZ; z += grid) {
    canvas.line(ox, py(z), ox + mapW, py(z), GRID, 1);
  }

  label(canvas, MARGIN + 18, TITLE_H + 18, "N", INK, 2);
  arrow(canvas, MARGIN + 23, TITLE_H + 58, 0, -25, INK, 2);
  label(canvas, mapSize - 164, TITLE_H + 18, "100 M GRID", INK, 2);

  // Only hazards within the course's visual working distance are shown.
  // Far-coast scenery is deliberately absent from a scoring schematic.
  let closestHazard = Infinity;
  for (const solid of level.solids) {
    if (solid.kind === "buoy") continue;
    const clearance = polylineDistance(points, solid.x, solid.z) - solid.r;
    closestHazard = Math.min(closestHazard, clearance);
    if (clearance > 50) continue;
    const radius = Math.max(2, solid.r * scale);
    canvas.disk(px(solid.x), py(solid.z), radius, [HAZARD[0], HAZARD[1], HAZARD[2], 125]);
    canvas.circle(px(solid.x), py(solid.z), radius, HAZARD, 1);
  }

  // Curvature is inked segment by segment: blue is nearly straight, green
  // open, amber working, red within 20% of R23's floor.
  for (let i = 0; i + 1 < points.length; i++) {
    const curve = curveAt(points, i);
    const color =
      curve.radius < R.course.radius * 1.2
        ? CURVE.tight
        : curve.radius < R.course.radius * 2
          ? CURVE.working
          : curve.radius < R.course.radius * 5
            ? CURVE.open
            : CURVE.straight;
    canvas.line(
      px(points[i].x),
      py(points[i].z),
      px(points[i + 1].x),
      py(points[i + 1].z),
      color,
      4,
    );
  }

  // Direction arrows every quarter lap make a closed line readable without
  // relying on the order of its checkpoint labels.
  for (
    let i = Math.floor(points.length / 8);
    i < points.length - 1;
    i += Math.max(1, Math.floor(points.length / 4))
  ) {
    const a = points[i];
    const b = points[i + 1];
    arrow(canvas, px(a.x), py(a.z), px(b.x) - px(a.x), py(b.z) - py(a.z), INK, 2);
  }

  const gates = level.course.gates.slice(0, level.course.lapGates);
  // What the checkpoint order actually asks the rider to do around a
  // slalom: leave the natural line, cross close beside the can, return
  // toward the next checkpoint. The base curve stays visible underneath,
  // so a buoy that can be collected by merely following it is obvious.
  for (let i = 0; i < gates.length; i++) {
    const gate = gates[i];
    if (gate.kind !== "slalom") continue;
    const before = gatePassPoint(gates[(i - 1 + gates.length) % gates.length]);
    const target = gatePassPoint(gate);
    const after = gatePassPoint(gates[(i + 1) % gates.length]);
    canvas.line(px(before.x), py(before.z), px(target.x), py(target.z), DETOUR, 4);
    canvas.line(px(target.x), py(target.z), px(after.x), py(after.z), DETOUR, 4);
    canvas.disk(px(target.x), py(target.z), 4, DETOUR);
  }
  const slalomMarks = new Set();
  let slalomOrdinal = 0;
  for (let i = 0; i < gates.length; i++) {
    const gate = gates[i];
    const rx = Math.cos(gate.heading);
    const rz = -Math.sin(gate.heading);
    if (gate.kind === "water") {
      const half = gate.width / 2;
      canvas.line(
        px(gate.x + rx * half),
        py(gate.z + rz * half),
        px(gate.x - rx * half),
        py(gate.z - rz * half),
        CHECKPOINT,
        2,
      );
    } else if (gate.kind === "slalom") {
      const keepLeft = gate.rounding === "left";
      const color = keepLeft ? LEFT : RIGHT;
      const passSide = keepLeft ? 1 : -1;
      const reach = gate.width / 2;
      dashedLine(
        canvas,
        px(gate.x),
        py(gate.z),
        px(gate.x + rx * reach * passSide),
        py(gate.z + rz * reach * passSide),
        color,
        3,
      );
      canvas.disk(px(gate.x), py(gate.z), 7, color);
      canvas.circle(px(gate.x), py(gate.z), 10, color, 2);
      if (gate.mark) slalomMarks.add(gate.mark);
    } else if (gate.ramp) {
      drawRamp(canvas, gate, level.pace, px, py, scale);
      canvas.circle(px(gate.x), py(gate.z), Math.max(5, gate.width * scale * 0.5), RAMP, 2);
    }
    const tag =
      gate.kind === "slalom"
        ? `CP${i + 1} / ${gate.mark ?? "BUOY"} ${gate.rounding === "left" ? "LEFT / RED" : "RIGHT / YELLOW"}`
        : `CP${i + 1}`;
    const gateColor =
      gate.kind === "air"
        ? RAMP
        : gate.kind === "slalom"
          ? gate.rounding === "left"
            ? LEFT
            : RIGHT
          : CHECKPOINT;
    if (gate.kind === "slalom") {
      const detail = `${(gate.standoff ?? 0).toFixed(0)} M IDEAL; <= ${(gate.width / 2).toFixed(0)} M PASSES`;
      const rightHalf = px(gate.x) >= mapSize / 2;
      const labelWidth = Math.max(textWidth(tag, 2), textWidth(detail, 2));
      const wantedX = rightHalf ? px(gate.x) + 14 : px(gate.x) - 14 - labelWidth;
      const wantedY = py(gate.z) + (slalomOrdinal % 2 === 0 ? -31 : 18);
      const labelX = Math.max(MARGIN + 6, Math.min(mapSize - MARGIN - 6 - labelWidth, wantedX));
      const labelY = Math.max(
        TITLE_H + MARGIN + 8,
        Math.min(TITLE_H + mapSize - MARGIN - 44, wantedY),
      );
      canvas.fillRect(labelX - 4, labelY - 4, labelWidth + 8, 42, [...PAPER, 220]);
      label(canvas, labelX, labelY, tag, gateColor, 2);
      label(canvas, labelX, labelY + 19, detail, gateColor, 2);
      slalomOrdinal++;
    } else {
      label(
        canvas,
        px(gate.x) + rx * 17 - (rx < 0 ? textWidth(tag, 2) : 0),
        py(gate.z) - rz * 17 - 7,
        tag,
        gateColor,
        2,
      );
    }
  }

  // A malformed level can still publish a buoy without making it a
  // checkpoint. Keep it visible so the schematic exposes the defect rather
  // than silently dropping it; valid generated levels render each buoy in
  // the gate loop above.
  for (const buoy of level.solids.filter((solid) => solid.kind === "buoy")) {
    if (slalomMarks.has(buoy.id)) continue;
    const nearest = nearestSample(points, buoy);
    const left = buoy.rounding === "left";
    const side = left ? LEFT : RIGHT;
    dashedLine(canvas, px(buoy.x), py(buoy.z), px(nearest.point.x), py(nearest.point.z), side, 2);
    canvas.disk(px(buoy.x), py(buoy.z), 7, side);
    canvas.circle(px(buoy.x), py(buoy.z), 10, side, 2);
    const line1 = `${buoy.id} ${left ? "LEFT / RED" : "RIGHT / YELLOW"}`;
    const line2 = `${nearest.distance.toFixed(0)} M IDEAL STANDOFF`;
    const labelX =
      px(buoy.x) > mapSize * 0.7
        ? px(buoy.x) - 14 - Math.max(textWidth(line1, 2), textWidth(line2, 2))
        : px(buoy.x) + 14;
    label(canvas, labelX, py(buoy.z) - 16, line1, side, 2);
    label(canvas, labelX, py(buoy.z) + 2, line2, side, 2);
  }

  const start = level.start;
  canvas.disk(px(start.x), py(start.z), 6, START);
  arrow(
    canvas,
    px(start.x),
    py(start.z),
    Math.sin(start.heading) * 24,
    -Math.cos(start.heading) * 24,
    START,
    3,
  );
  label(canvas, px(start.x) - 38, py(start.z) + 13, "START", START, 2);
  const finish = gates[0];
  if (finish) label(canvas, px(finish.x) - 42, py(finish.z) - 48, "FINISH", INK, 2);

  canvas.rect(MARGIN, TITLE_H + MARGIN, mapInner, mapInner, INK);
  canvas.text(title, MARGIN, 12, INK, 3);

  const panelY = TITLE_H + mapSize + 18;
  canvas.line(MARGIN, panelY - 12, mapSize - MARGIN, panelY - 12, INK, 1);
  const score = analysis.closedCourse;
  const column = Math.floor((mapSize - MARGIN * 2) / 3);
  const sx = MARGIN;
  let sy = panelY;
  canvas.text(
    `SCORE ${score.score.toFixed(1)} / 100`,
    sx,
    sy,
    score.score >= score.floor ? START : LEFT,
    3,
  );
  sy += 34;
  canvas.text(`PASS AT ${score.floor} OR ABOVE`, sx, sy, INK, 2);
  sy += 28;
  for (const group of score.metrics) {
    canvas.text(group.label, sx, sy, INK, 2);
    canvas.fillRect(sx, sy + 18, column - 72, 10, [210, 210, 210]);
    const color = group.score >= 0.9 ? START : group.score >= 0.7 ? CURVE.working : LEFT;
    canvas.fillRect(sx, sy + 18, (column - 72) * group.score, 10, color);
    canvas.text(`${(group.score * 100).toFixed(0)}%`, sx + column - 60, sy + 12, INK, 2);
    sy += 48;
  }

  const dx = MARGIN + column;
  let dy = panelY;
  canvas.text("READ THE LAP", dx, dy, INK, 3);
  dy += 38;
  const firstTurn = checkValue(score, "start", "first-turn") ?? 0;
  const airGates = gates.filter((gate) => gate.kind === "air").length;
  const stats = [
    `${level.course.laps} LAPS  ${level.course.lapGates} CP/LAP`,
    `${((to - from) / 1000).toFixed(2)} KM/LAP  ${(level.course.length / 1000).toFixed(2)} KM RACE`,
    `FIRST TURN ${firstTurn.toFixed(0)} M  MIN 120 M`,
    `TIGHTEST RADIUS ${analysis.stats.radius.toFixed(0)} M`,
    `RADIUS FLOOR ${R.course.radius} M`,
    `WORST CP TURN ${((analysis.stats.corner * 180) / Math.PI).toFixed(0)}°`,
    `CP TURN LIMIT ${((GATE_CORNER * 180) / Math.PI).toFixed(0)}°`,
    `MIN DEPTH ${analysis.stats.minDepth.toFixed(1)} M  FLOOR ${R.course.minDepth} M`,
    `MIN CLEAR ${closestHazard.toFixed(1)} M  FLOOR 6 M`,
    `${airGates} RAMP${airGates === 1 ? "" : "S"} PER LAP`,
  ];
  for (const line of stats) {
    canvas.text(line, dx, dy, INK, 2);
    dy += 25;
  }

  dy += 8;
  canvas.text("WAVES TRAVEL TOWARD", dx, dy, INK, 2);
  dy += 28;
  for (const band of waveBands) {
    const color = WAVE[band.kind] ?? INK;
    const length = 34;
    arrow(
      canvas,
      dx + 18 - Math.sin(band.heading) * length * 0.5,
      dy + 5 + Math.cos(band.heading) * length * 0.5,
      Math.sin(band.heading) * length,
      -Math.cos(band.heading) * length,
      color,
      3,
    );
    canvas.text(
      `${band.kind} ${band.degrees.toFixed(0)}°  HS ${band.hs.toFixed(2)} M`,
      dx + 50,
      dy - 2,
      color,
      2,
    );
    dy += 27;
  }

  const kx = MARGIN + column * 2;
  let ky = panelY;
  canvas.text("HOW TO READ IT", kx, ky, INK, 3);
  ky += 40;
  const key = (draw, text) => {
    draw(kx + 14, ky + 8);
    canvas.text(text, kx + 36, ky, INK, 2);
    ky += 27;
  };
  key(
    (x, y) => canvas.line(x - 11, y, x + 11, y, CURVE.straight, 5),
    `BLUE: R >= ${R.course.radius * 5} M`,
  );
  key(
    (x, y) => canvas.line(x - 11, y, x + 11, y, CURVE.open, 5),
    `GREEN: R ${R.course.radius * 2}–${R.course.radius * 5} M`,
  );
  key(
    (x, y) => canvas.line(x - 11, y, x + 11, y, CURVE.working, 5),
    `AMBER: R ${Math.round(R.course.radius * 1.2)}–${R.course.radius * 2} M`,
  );
  key(
    (x, y) => canvas.line(x - 11, y, x + 11, y, CURVE.tight, 5),
    `RED: R < ${Math.round(R.course.radius * 1.2)} M`,
  );
  key((x, y) => canvas.line(x - 11, y, x + 11, y, CHECKPOINT, 3), "BLUE CP: PASS BETWEEN PAIR");
  key((x, y) => canvas.disk(x, y, 7, LEFT), "RED CP: KEEP BUOY ON LEFT");
  key((x, y) => canvas.disk(x, y, 7, RIGHT), "YELLOW CP: KEEP BUOY ON RIGHT");
  key((x, y) => canvas.line(x - 11, y, x + 11, y, DETOUR, 5), "PURPLE: REQUIRED BUOY DETOUR");
  canvas.text("COLOURED DASH: VALID SIDE", kx, ky + 4, INK, 2);
  canvas.text(`PASS WITHIN ${R.circuit.mark.pass} M`, kx, ky + 28, INK, 2);
  ky += 55;
  key((x, y) => canvas.line(x - 11, y, x + 11, y, RAMP, 6), "MAGENTA: RAMP CORRIDOR");
  key((x, y) => canvas.disk(x, y, 6, HAZARD), "GREY: HAZARD <= 50 M");
  canvas.text("BLACK ARROWS ON LINE:", kx, ky + 4, INK, 2);
  canvas.text("RACE DIRECTION", kx, ky + 28, INK, 2);
  return canvas;
}
