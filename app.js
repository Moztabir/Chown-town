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

  if (!mapDiv || !routeBtn || !clearRouteBtn || !stepsOl) {
    console.error("Missing required HTML IDs (chownMap, routeBtn, clearRouteBtn, steps).");
    return;
  }

  const endSearch = document.getElementById("endSearch");
  const endResults = document.getElementById("endResults");
  const filterWashroom = document.getElementById("filterWashroom");
  const directionsCard = document.getElementById("directionsCard");
  const etaText = document.getElementById("etaText");

  const useLocationBtn = document.getElementById("useLocationBtn");
  const locationStatus = document.getElementById("locationStatus");

  if (!data.image || typeof data.image.width !== "number" || typeof data.image.height !== "number") {
    console.error("LEVEL3.image missing width/height");
    return;
  }
  if (!data.hallway || !data.hallway.nodes || !Array.isArray(data.hallway.edges)) {
    console.error("LEVEL3.hallway missing nodes/edges");
    return;
  }
  if (!data.roomsByBlock || typeof data.roomsByBlock !== "object") data.roomsByBlock = {};
  if (!Array.isArray(data.pois)) data.pois = [];

  const map = L.map("chownMap", { crs: L.CRS.Simple, minZoom: -2, maxZoom: 4 });
  const bounds = [[0, 0], [data.image.height, data.image.width]];
  L.imageOverlay(data.image.url, bounds).addTo(map);
  map.fitBounds(bounds);

  const poiLayer = L.layerGroup().addTo(map);
  const routeLayer = L.layerGroup().addTo(map);
  const userLayer = L.layerGroup().addTo(map);

  let selectedEnd = null;
  let userLocation = null; // image x/y
  let watchId = null;
  let isTracking = false;

  function setSteps(lines) {
    stepsOl.innerHTML = "";
    lines.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      stepsOl.appendChild(li);
    });
  }

  function showDirections() {
    if (directionsCard) directionsCard.classList.remove("d-none");
  }

  function hideDirections() {
    if (directionsCard) directionsCard.classList.add("d-none");
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
      const arr = data.roomsByBlock[blockKey] || [];
      for (const r of arr) out.push({ code: r.code, x: r.x, y: r.y, block: blockKey });
    }
    out.sort((a, b) => String(a.code).localeCompare(String(b.code)));
    return out;
  }

  function drawWashrooms() {
    poiLayer.clearLayers();
    if (!filterWashroom?.checked) return;

    const washrooms = data.pois.filter(p =>
      p && p.type === "washroom" && typeof p.x === "number" && typeof p.y === "number"
    );

    washrooms.forEach(w => {
      L.circleMarker([w.y, w.x], {
        radius: 8,
        color: "#1976d2",
        fillColor: "#1976d2",
        fillOpacity: 1
      }).addTo(poiLayer).bindPopup(`<b>${w.label || "Washroom"}</b>`);
    });
  }

  filterWashroom?.addEventListener("change", () => {
    drawWashrooms();
    if (endResults) endResults.innerHTML = "";
  });

  drawWashrooms();

  function normalizeQuery(s) {
    return (s || "").toUpperCase().trim();
  }

  function getSearchItems() {
    const items = [];

    getAllRooms().forEach(r => {
      if (typeof r.x === "number" && typeof r.y === "number") {
        items.push({ kind: "room", code: r.code, ref: r });
      }
    });

    data.pois
      .filter(p => p && p.type === "washroom" && typeof p.x === "number" && typeof p.y === "number")
      .forEach(p => items.push({ kind: "poi", code: p.label, ref: p }));

    return items;
  }

  function doSearch(q) {
    const qq = normalizeQuery(q);
    if (!qq) return [];
    return getSearchItems()
      .filter(it => normalizeQuery(it.code).includes(qq))
      .slice(0, 10);
  }

  function renderResults(container, results, onPick) {
    if (!container) return;
    container.innerHTML = "";
    results.forEach(r => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-group-item list-group-item-action py-1";
      btn.textContent = r.code;
      btn.addEventListener("click", () => onPick(r));
      container.appendChild(btn);
    });
  }

  function pickEnd(item) {
    selectedEnd = item;
    if (endSearch) endSearch.value = item.code;
    if (endResults) endResults.innerHTML = "";
    if (userLocation) {
      routeItems(userLocation, selectedEnd);
    }
  }

  endSearch?.addEventListener("input", () => {
    renderResults(endResults, doSearch(endSearch.value), pickEnd);
  });

  endSearch?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const typed = endSearch.value.trim();
    const exact = getSearchItems().find(it => it.code === typed);
    if (exact) pickEnd(exact);
  });

  function drawUserDot(point) {
    userLayer.clearLayers();

    L.circleMarker([point.y, point.x], {
      radius: 10,
      color: "#ffffff",
      weight: 3,
      fillColor: "#1e88ff",
      fillOpacity: 1
    }).addTo(userLayer).bindPopup("<b>Your Location</b>");

    L.circleMarker([point.y, point.x], {
      radius: 18,
      color: "#1e88ff",
      weight: 1,
      fillColor: "#1e88ff",
      fillOpacity: 0.18
    }).addTo(userLayer);
  }

  function gpsToImageXY(lat, lng) {
    const cal = data.gpsCalibration;
    if (!cal || !cal.enabled || !cal.topLeft || !cal.bottomRight) return null;

    const latMax = cal.topLeft.lat;
    const latMin = cal.bottomRight.lat;
    const lngMin = cal.topLeft.lng;
    const lngMax = cal.bottomRight.lng;

    if (
      typeof latMax !== "number" ||
      typeof latMin !== "number" ||
      typeof lngMin !== "number" ||
      typeof lngMax !== "number"
    ) {
      return null;
    }

    const xRatio = (lng - lngMin) / (lngMax - lngMin);
    const yRatio = (latMax - lat) / (latMax - latMin);

    const x = xRatio * data.image.width;
    const y = yRatio * data.image.height;

    return {
      x: Math.max(0, Math.min(data.image.width, x)),
      y: Math.max(0, Math.min(data.image.height, y))
    };
  }

  function getPointFromItem(item) {
    if (!item) return null;
    const p = item.ref;
    if (p.x == null || p.y == null) return null;
    return { x: p.x, y: p.y };
  }

  function closestPointOnSegment(P, A, B) {
    const ABx = B.x - A.x, ABy = B.y - A.y;
    const APx = P.x - A.x, APy = P.y - A.y;

    const ab2 = ABx * ABx + ABy * ABy;
    if (ab2 === 0) {
      const dx = P.x - A.x, dy = P.y - A.y;
      return { x: A.x, y: A.y, dist2: dx * dx + dy * dy };
    }

    let t = (APx * ABx + APy * ABy) / ab2;
    t = Math.max(0, Math.min(1, t));

    const x = A.x + t * ABx;
    const y = A.y + t * ABy;

    const dx = P.x - x, dy = P.y - y;
    return { x, y, dist2: dx * dx + dy * dy };
  }

  function snapPointToHallwayEdge(hallway, point) {
    let best = null;
    for (const [u, v] of hallway.edges) {
      const A = hallway.nodes[u];
      const B = hallway.nodes[v];
      if (!A || !B) continue;

      const proj = closestPointOnSegment(point, A, B);
      if (!best || proj.dist2 < best.proj.dist2) best = { u, v, proj };
    }
    return best;
  }

  function cloneHallway(h) {
    return {
      nodes: JSON.parse(JSON.stringify(h.nodes)),
      edges: h.edges.map(e => [e[0], e[1]])
    };
  }

  function insertEntryNode(working, entryId, point) {
    const snap = snapPointToHallwayEdge(working, point);
    if (!snap) return null;

    const { u, v, proj } = snap;
    working.nodes[entryId] = { x: proj.x, y: proj.y };

    working.edges = working.edges.filter(([a, b]) =>
      !((a === u && b === v) || (a === v && b === u))
    );

    working.edges.push([u, entryId]);
    working.edges.push([entryId, v]);
    return entryId;
  }

  function buildAdjFor(h) {
    const adj = {};
    Object.keys(h.nodes).forEach(k => (adj[k] = []));
    h.edges.forEach(([u, v]) => {
      const w = dist(h.nodes[u], h.nodes[v]);
      adj[u].push({ to: v, w });
      adj[v].push({ to: u, w });
    });
    return adj;
  }

  function dijkstraFor(h, start, end) {
    const adj = buildAdjFor(h);
    const nodes = Object.keys(adj);

    const distMap = {};
    const prev = {};
    const visited = new Set();

    nodes.forEach(n => (distMap[n] = Infinity));
    distMap[start] = 0;

    while (true) {
      let cur = null, best = Infinity;
      for (const n of nodes) {
        if (!visited.has(n) && distMap[n] < best) {
          best = distMap[n];
          cur = n;
        }
      }
      if (!cur) break;
      if (cur === end) break;

      visited.add(cur);

      for (const { to, w } of adj[cur]) {
        const nd = distMap[cur] + w;
        if (nd < distMap[to]) {
          distMap[to] = nd;
          prev[to] = cur;
        }
      }
    }

    if (start === end) return [start];
    if (!prev[end]) return [];
    const path = [end];
    while (path[0] !== start) path.unshift(prev[path[0]]);
    return path;
  }

  function simplifyPoints(points, minSegmentPx = 18) {
    const out = [];
    for (const p of points) {
      if (out.length === 0) {
        out.push(p);
        continue;
      }
      const last = out[out.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= minSegmentPx) out.push(p);
    }
    return out;
  }

  function signedAngleDeg(a, b, c) {
    const v1 = { x: a.x - b.x, y: a.y - b.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const cross = v1.x * v2.y - v1.y * v2.x;
    return Math.atan2(cross, dot) * (180 / Math.PI);
  }

  function turnText(angle) {
    const abs = Math.abs(angle);
    if (abs < 25) return null;
    return angle > 0 ? "Turn left" : "Turn right";
  }

  function routeDistancePx(points) {
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      d += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return d;
  }

  function computeETA(distancePx) {
    const mpp = data.calibration?.metersPerPixel ?? 0.03;
    const speed = data.calibration?.walkingSpeedMps ?? 1.3;
    const meters = distancePx * mpp;
    const minutes = Math.max(1, Math.round((meters / speed) / 60));
    return { meters: Math.round(meters), minutes };
  }

  function buildTurnByTurn(hallwayPoints, startLabel, endLabel) {
    const pts = simplifyPoints(hallwayPoints);
    const px = routeDistancePx(pts);
    const { meters, minutes } = computeETA(px);

    const steps = [];
    const etaLine = `ETA: ~${minutes} min (${meters} m)`;
    steps.push(etaLine);
    steps.push(`Start: ${startLabel}`);

    if (pts.length >= 2) {
      steps.push("Go straight");
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i - 1], b = pts[i], c = pts[i + 1];
        const ang = signedAngleDeg(a, b, c);
        const t = turnText(ang);
        if (t) steps.push(t);
      }
    }

    steps.push(`Arrive: ${endLabel}`);

    if (etaText) etaText.textContent = etaLine.replace("ETA:", "ETA");
    return steps;
  }

  function routeItems(startPoint, endItem) {
    routeLayer.clearLayers();

    if (!startPoint || !endItem) {
      hideDirections();
      return;
    }

    const A = startPoint;
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

    const coords = [
      [A.y, A.x],
      ...hallwayPath.map(id => {
        const p = working.nodes[id];
        return [p.y, p.x];
      }),
      [B.y, B.x]
    ];

    const mainLine = L.polyline(coords, {
      weight: 8,
      opacity: 0.9
    }).addTo(routeLayer);

    const sPt = working.nodes[sId];
    const ePt = working.nodes[eId];

    L.polyline([[A.y, A.x], [sPt.y, sPt.x]], {
      dashArray: "6 8",
      weight: 4,
      opacity: 0.85
    }).addTo(routeLayer);

    L.polyline([[B.y, B.x], [ePt.y, ePt.x]], {
      dashArray: "6 8",
      weight: 4,
      opacity: 0.85
    }).addTo(routeLayer);

    const hallwayPoints = hallwayPath.map(id => working.nodes[id]);
    const steps = buildTurnByTurn(hallwayPoints, "Your Location", endItem.code);
    setSteps(steps);
    showDirections();

    if (mainLine.getBounds().isValid()) {
      map.fitBounds(mainLine.getBounds(), { padding: [40, 40] });
    }
  }

  function updateLocationFromGPS(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    const mapped = gpsToImageXY(lat, lng);
    if (!mapped) {
      if (locationStatus) {
        locationStatus.textContent = "GPS received, but map calibration is missing.";
      }
      return;
    }

    userLocation = mapped;
    drawUserDot(userLocation);

    if (locationStatus) {
      locationStatus.textContent =
        `Tracking live • lat ${lat.toFixed(6)}, lng ${lng.toFixed(6)} • ±${Math.round(accuracy)}m`;
    }

    if (selectedEnd) {
      routeItems(userLocation, selectedEnd);
    }
  }

  function handleLocationError(error) {
    let msg = "Location error.";
    switch (error.code) {
      case error.PERMISSION_DENIED:
        msg = "Location permission denied.";
        break;
      case error.POSITION_UNAVAILABLE:
        msg = "Location unavailable.";
        break;
      case error.TIMEOUT:
        msg = "Location request timed out.";
        break;
    }
    if (locationStatus) locationStatus.textContent = msg;
  }

  function startTracking() {
    if (!navigator.geolocation) {
      if (locationStatus) locationStatus.textContent = "Geolocation is not supported on this device.";
      return;
    }

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    watchId = navigator.geolocation.watchPosition(
      updateLocationFromGPS,
      handleLocationError,
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    );

    isTracking = true;
    if (locationStatus) {
      locationStatus.textContent = "Starting live GPS tracking...";
    }
  }

  function clearRoute() {
    routeLayer.clearLayers();
    userLayer.clearLayers();
    userLocation = null;
    hideDirections();
    map.fitBounds(bounds);

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    isTracking = false;
    if (locationStatus) {
      locationStatus.textContent = "Tracking stopped.";
    }
  }

  useLocationBtn?.addEventListener("click", startTracking);
  routeBtn.addEventListener("click", () => routeItems(userLocation, selectedEnd));
  clearRouteBtn.addEventListener("click", clearRoute);
});