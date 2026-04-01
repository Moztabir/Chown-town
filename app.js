document.addEventListener("DOMContentLoaded", () => {
  const data = window.LEVEL3;

  if (!data) {
    console.error("LEVEL3 not found. Load data-level3.js before app.js");
    return;
  }

  const mapDiv = document.getElementById("chownMap");
  const routeBtn = document.getElementById("routeBtn");
  const clearRouteBtn = document.getElementById("clearRouteBtn");
  const stepsOl = document.getElementById("steps");

  const startSearch = document.getElementById("startSearch");
  const startResults = document.getElementById("startResults");
  const endSearch = document.getElementById("endSearch");
  const endResults = document.getElementById("endResults");

  const filterWashroom = document.getElementById("filterWashroom");
  const directionsCard = document.getElementById("directionsCard");
  const etaText = document.getElementById("etaText");

  if (
    !mapDiv ||
    !routeBtn ||
    !clearRouteBtn ||
    !stepsOl ||
    !startSearch ||
    !startResults ||
    !endSearch ||
    !endResults
  ) {
    console.error(
      "Missing required HTML IDs (chownMap, routeBtn, clearRouteBtn, steps, startSearch, startResults, endSearch, endResults)."
    );
    return;
  }

  if (
    !data.image ||
    typeof data.image.width !== "number" ||
    typeof data.image.height !== "number"
  ) {
    console.error("LEVEL3.image missing width/height");
    return;
  }

  if (
    !data.hallway ||
    !data.hallway.nodes ||
    !Array.isArray(data.hallway.edges)
  ) {
    console.error("LEVEL3.hallway missing nodes/edges");
    return;
  }

  if (!data.roomsByBlock || typeof data.roomsByBlock !== "object") {
    data.roomsByBlock = {};
  }

  if (!Array.isArray(data.pois)) {
    data.pois = [];
  }

  const map = L.map("chownMap", {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 4
  });

  const bounds = [
    [0, 0],
    [data.image.height, data.image.width]
  ];

  L.imageOverlay(data.image.url, bounds).addTo(map);
  map.fitBounds(bounds);

  const poiLayer = L.layerGroup().addTo(map);
  const routeLayer = L.layerGroup().addTo(map);
  const markerLayer = L.layerGroup().addTo(map);

  let selectedStart = null;
  let selectedEnd = null;

  function setSteps(lines) {
    stepsOl.innerHTML = "";
    lines.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      stepsOl.appendChild(li);
    });
  }

  function showDirections() {
    directionsCard?.classList.remove("d-none");
  }

  function hideDirections() {
    directionsCard?.classList.add("d-none");
    if (etaText) etaText.textContent = "";
    setSteps([]);
  }

  hideDirections();

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getAllRooms() {
    const out = [];

    for (const blockKey of Object.keys(data.roomsByBlock)) {
      const rooms = data.roomsByBlock[blockKey] || [];

      for (const room of rooms) {
        if (
          room &&
          typeof room.code === "string" &&
          typeof room.x === "number" &&
          typeof room.y === "number"
        ) {
          out.push({
            code: room.code,
            x: room.x,
            y: room.y,
            block: blockKey
          });
        }
      }
    }

    out.sort((a, b) => String(a.code).localeCompare(String(b.code)));
    return out;
  }

  function normalizeQuery(value) {
    return (value || "").toUpperCase().trim();
  }

  function getSearchItems() {
    const items = [];

    getAllRooms().forEach((room) => {
      items.push({
        kind: "room",
        code: room.code,
        ref: room
      });
    });

    data.pois
      .filter((p) => {
        return (
          p &&
          p.type === "washroom" &&
          typeof p.x === "number" &&
          typeof p.y === "number"
        );
      })
      .forEach((poi) => {
        items.push({
          kind: "poi",
          code: poi.label || "Washroom",
          ref: poi
        });
      });

    return items;
  }

  function doSearch(query) {
    const q = normalizeQuery(query);
    if (!q) return [];

    return getSearchItems()
      .filter((item) => normalizeQuery(item.code).includes(q))
      .slice(0, 10);
  }

  function renderResults(container, results, onPick) {
    container.innerHTML = "";

    results.forEach((result) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-group-item list-group-item-action py-1";
      btn.textContent = result.code;
      btn.addEventListener("click", () => onPick(result));
      container.appendChild(btn);
    });
  }

  function getPointFromItem(item) {
    if (!item || !item.ref) return null;

    const point = item.ref;
    if (typeof point.x !== "number" || typeof point.y !== "number") return null;

    return { x: point.x, y: point.y };
  }

  function drawWashrooms() {
    poiLayer.clearLayers();

    if (!filterWashroom?.checked) return;

    const washrooms = data.pois.filter((p) => {
      return (
        p &&
        p.type === "washroom" &&
        typeof p.x === "number" &&
        typeof p.y === "number"
      );
    });

    washrooms.forEach((w) => {
      L.circleMarker([w.y, w.x], {
        radius: 8,
        color: "#1976d2",
        fillColor: "#1976d2",
        fillOpacity: 1
      })
        .addTo(poiLayer)
        .bindPopup(`<b>${w.label || "Washroom"}</b>`);
    });
  }

  function drawStartEndMarkers() {
    markerLayer.clearLayers();

    if (selectedStart) {
      const startPoint = getPointFromItem(selectedStart);
      if (startPoint) {
        L.circleMarker([startPoint.y, startPoint.x], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: "#22c55e",
          fillOpacity: 1
        })
          .addTo(markerLayer)
          .bindPopup(`<b>Start:</b> ${selectedStart.code}`);
      }
    }

    if (selectedEnd) {
      const endPoint = getPointFromItem(selectedEnd);
      if (endPoint) {
        L.circleMarker([endPoint.y, endPoint.x], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: "#ef4444",
          fillOpacity: 1
        })
          .addTo(markerLayer)
          .bindPopup(`<b>End:</b> ${selectedEnd.code}`);
      }
    }
  }

  function pickStart(item) {
    selectedStart = item;
    startSearch.value = item.code;
    startResults.innerHTML = "";
    drawStartEndMarkers();
  }

  function pickEnd(item) {
    selectedEnd = item;
    endSearch.value = item.code;
    endResults.innerHTML = "";
    drawStartEndMarkers();
  }

  startSearch.addEventListener("input", () => {
    renderResults(startResults, doSearch(startSearch.value), pickStart);
  });

  endSearch.addEventListener("input", () => {
    renderResults(endResults, doSearch(endSearch.value), pickEnd);
  });

  startSearch.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const typed = normalizeQuery(startSearch.value);
    const exact = getSearchItems().find(
      (item) => normalizeQuery(item.code) === typed
    );

    if (exact) pickStart(exact);
  });

  endSearch.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const typed = normalizeQuery(endSearch.value);
    const exact = getSearchItems().find(
      (item) => normalizeQuery(item.code) === typed
    );

    if (exact) pickEnd(exact);
  });

  document.addEventListener("click", (e) => {
    if (!startResults.contains(e.target) && e.target !== startSearch) {
      startResults.innerHTML = "";
    }

    if (!endResults.contains(e.target) && e.target !== endSearch) {
      endResults.innerHTML = "";
    }
  });

  filterWashroom?.addEventListener("change", () => {
    drawWashrooms();
    startResults.innerHTML = "";
    endResults.innerHTML = "";
  });

  drawWashrooms();

  function closestPointOnSegment(P, A, B) {
    const ABx = B.x - A.x;
    const ABy = B.y - A.y;
    const APx = P.x - A.x;
    const APy = P.y - A.y;

    const ab2 = ABx * ABx + ABy * ABy;

    if (ab2 === 0) {
      const dx = P.x - A.x;
      const dy = P.y - A.y;
      return {
        x: A.x,
        y: A.y,
        dist2: dx * dx + dy * dy
      };
    }

    let t = (APx * ABx + APy * ABy) / ab2;
    t = Math.max(0, Math.min(1, t));

    const x = A.x + t * ABx;
    const y = A.y + t * ABy;

    const dx = P.x - x;
    const dy = P.y - y;

    return {
      x,
      y,
      dist2: dx * dx + dy * dy
    };
  }

  function snapPointToHallwayEdge(hallway, point) {
    let best = null;

    for (const [u, v] of hallway.edges) {
      const A = hallway.nodes[u];
      const B = hallway.nodes[v];
      if (!A || !B) continue;

      const proj = closestPointOnSegment(point, A, B);

      if (!best || proj.dist2 < best.proj.dist2) {
        best = { u, v, proj };
      }
    }

    return best;
  }

  function cloneHallway(hallway) {
    return {
      nodes: JSON.parse(JSON.stringify(hallway.nodes)),
      edges: hallway.edges.map((edge) => [edge[0], edge[1]])
    };
  }

  function insertEntryNode(working, entryId, point) {
    const snap = snapPointToHallwayEdge(working, point);
    if (!snap) return null;

    const { u, v, proj } = snap;

    working.nodes[entryId] = {
      x: proj.x,
      y: proj.y
    };

    working.edges = working.edges.filter(([a, b]) => {
      return !((a === u && b === v) || (a === v && b === u));
    });

    working.edges.push([u, entryId]);
    working.edges.push([entryId, v]);

    return entryId;
  }

  function buildAdjFor(hallway) {
    const adj = {};

    Object.keys(hallway.nodes).forEach((key) => {
      adj[key] = [];
    });

    hallway.edges.forEach(([u, v]) => {
      const weight = dist(hallway.nodes[u], hallway.nodes[v]);
      adj[u].push({ to: v, w: weight });
      adj[v].push({ to: u, w: weight });
    });

    return adj;
  }

  function dijkstraFor(hallway, start, end) {
    const adj = buildAdjFor(hallway);
    const nodes = Object.keys(adj);

    const distMap = {};
    const prev = {};
    const visited = new Set();

    nodes.forEach((node) => {
      distMap[node] = Infinity;
    });

    distMap[start] = 0;

    while (true) {
      let cur = null;
      let best = Infinity;

      for (const node of nodes) {
        if (!visited.has(node) && distMap[node] < best) {
          best = distMap[node];
          cur = node;
        }
      }

      if (!cur) break;
      if (cur === end) break;

      visited.add(cur);

      for (const { to, w } of adj[cur]) {
        const newDist = distMap[cur] + w;
        if (newDist < distMap[to]) {
          distMap[to] = newDist;
          prev[to] = cur;
        }
      }
    }

    if (start === end) return [start];
    if (!prev[end]) return [];

    const path = [end];
    while (path[0] !== start) {
      path.unshift(prev[path[0]]);
    }

    return path;
  }

  function simplifyPoints(points, minSegmentPx = 18) {
  if (!Array.isArray(points) || points.length <= 2) return points || [];

  const out = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = points[i];
    const next = points[i + 1];

    const d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const d2 = Math.hypot(next.x - cur.x, next.y - cur.y);

    if (d1 < minSegmentPx && d2 < minSegmentPx) {
      continue;
    }

    out.push(cur);
  }

  out.push(points[points.length - 1]);
  return out;
}

  function signedAngleDeg(a, b, c) {
    const v1 = {
      x: b.x - a.x,
      y: b.y - a.y
    };

    const v2 = {
      x: c.x - b.x,
      y: c.y - b.y
    };

    const ang1 = Math.atan2(v1.y, v1.x);
    const ang2 = Math.atan2(v2.y, v2.x);

    let delta = (ang2 - ang1) * (180 / Math.PI);

    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;

    return delta;
  }

  function turnText(angle) {
  const abs = Math.abs(angle);

  if (abs < 35) return null;
  if (abs < 110) return angle > 0 ? "Turn left" : "Turn right";
  return angle > 0 ? "Sharp left" : "Sharp right";
}

  function routeDistancePx(points) {
    let total = 0;

    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(
        points[i].x - points[i - 1].x,
        points[i].y - points[i - 1].y
      );
    }

    return total;
  }

  function computeETA(distancePx) {
    const metersPerPixel = data.calibration?.metersPerPixel ?? 0.03;
    const walkingSpeedMps = data.calibration?.walkingSpeedMps ?? 1.3;

    const meters = distancePx * metersPerPixel;
    const minutes = Math.max(1, Math.round((meters / walkingSpeedMps) / 60));

    return {
      meters: Math.round(meters),
      minutes
    };
  }

  function buildTurnByTurn(routePoints, startLabel, endLabel) {
  const pts = simplifyPoints(routePoints, 18);
  const px = routeDistancePx(pts);
  const { meters, minutes } = computeETA(px);

  const instructions = [];
  const etaLine = `ETA: ~${minutes} min (${meters} m)`;

  if (etaText) {
    etaText.textContent = etaLine.replace("ETA:", "ETA");
  }

  instructions.push(`Start at ${startLabel}`);

  const majorTurns = [];

  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];

    const angle = signedAngleDeg(a, b, c);
    const abs = Math.abs(angle);

    const distFromStart = routeDistancePx(pts.slice(0, i + 1));
    const distToEnd = routeDistancePx(pts.slice(i));

    // ignore tiny bends and connector wiggles near start/end
    if (abs < 55) continue;
    if (distFromStart < 60 || distToEnd < 60) continue;

    majorTurns.push(angle > 0 ? "Turn left" : "Turn right");
  }

  // remove repeated duplicates like left + left
  const cleanedTurns = [];
  for (const turn of majorTurns) {
    if (cleanedTurns[cleanedTurns.length - 1] !== turn) {
      cleanedTurns.push(turn);
    }
  }

  if (cleanedTurns.length === 0) {
    instructions.push("Follow the hallway");
  } else if (cleanedTurns.length === 1) {
    instructions.push("Follow the hallway");
    instructions.push(cleanedTurns[0]);
    instructions.push("Continue along the hallway");
  } else {
    instructions.push("Follow the hallway");
    cleanedTurns.forEach((turn) => instructions.push(turn));
    instructions.push("Continue along the hallway");
  }

  instructions.push(`Arrive at ${endLabel}`);
  return instructions;
}

  function routeItems(startItem, endItem) {
    routeLayer.clearLayers();

    if (!startItem || !endItem) {
      hideDirections();
      return;
    }

    const A = getPointFromItem(startItem);
    const B = getPointFromItem(endItem);

    if (!A || !B) {
      hideDirections();
      return;
    }

    const working = cloneHallway(data.hallway);
    const sId = insertEntryNode(working, "ENTRY_START", A);
    const eId = insertEntryNode(working, "ENTRY_END", B);

    if (!sId || !eId) {
      hideDirections();
      return;
    }

    const hallwayPath = dijkstraFor(working, sId, eId);

    if (!hallwayPath.length) {
      hideDirections();
      return;
    }

    const fullRoutePoints = [
      A,
      ...hallwayPath.map((id) => working.nodes[id]),
      B
    ];

    const coords = fullRoutePoints.map((p) => [p.y, p.x]);

    const mainLine = L.polyline(coords, {
      weight: 8,
      opacity: 0.9
    }).addTo(routeLayer);

    const steps = buildTurnByTurn(fullRoutePoints, startItem.code, endItem.code);

    setSteps(steps);
    showDirections();
    drawStartEndMarkers();

    if (mainLine.getBounds().isValid()) {
      map.fitBounds(mainLine.getBounds(), { padding: [40, 40] });
    }
  }

  function clearRoute() {
    routeLayer.clearLayers();
    markerLayer.clearLayers();

    selectedStart = null;
    selectedEnd = null;

    startSearch.value = "";
    endSearch.value = "";
    startResults.innerHTML = "";
    endResults.innerHTML = "";

    hideDirections();
    map.fitBounds(bounds);
    drawWashrooms();
  }

  routeBtn.addEventListener("click", () => {
    if (!selectedStart || !selectedEnd) {
      alert("Please choose both a start classroom and an end classroom.");
      return;
    }

    routeItems(selectedStart, selectedEnd);
  });

  clearRouteBtn.addEventListener("click", clearRoute);
});