// app.js
// Clean UI behavior:
// - Directions hidden by default
// - Directions shown only after successful Route
// - Clear hides directions + clears route
// - Search suggestions for rooms + washrooms (washrooms always searchable)
// - Washroom checkbox ONLY toggles washroom icons on the map (not search)
// - Uses roomsByBlock as source of truth

document.addEventListener("DOMContentLoaded", () => {
  const data = window.LEVEL3;
  if (!data) {
    console.error("LEVEL3 not found. Load data-level3.js before app.js");
    return;
  }

  // ---------- Required DOM ----------
  const mapDiv = document.getElementById("chownMap");
  const routeBtn = document.getElementById("routeBtn");
  const clearRouteBtn = document.getElementById("clearRouteBtn");
  const stepsOl = document.getElementById("steps");

  if (!mapDiv || !routeBtn || !clearRouteBtn || !stepsOl) {
    console.error("Missing required HTML IDs (chownMap, routeBtn, clearRouteBtn, steps).");
    return;
  }

  // ---------- Optional DOM ----------
  const startSearch = document.getElementById("startSearch");
  const endSearch = document.getElementById("endSearch");
  const startResults = document.getElementById("startResults");
  const endResults = document.getElementById("endResults");

  const filterWashroom = document.getElementById("filterWashroom");

  // Admin placement (optional)
  const modeSelect = document.getElementById("modeSelect"); // route | roomAdd
  const roomSelect = document.getElementById("roomSelect");
  const roomCodeInput = document.getElementById("roomCodeInput");
  const addRoomBtn = document.getElementById("addRoomBtn");
  const clearRoomsBtn = document.getElementById("clearRoomsBtn");
  const roomsOut = document.getElementById("roomsOut");

  // Directions wrapper
  const directionsCard = document.getElementById("directionsCard");
  const etaText = document.getElementById("etaText");

  // ---------- Data safety ----------
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

  // ---------- Map init ----------
  const map = L.map("chownMap", { crs: L.CRS.Simple, minZoom: -2, maxZoom: 4 });
  const bounds = [[0, 0], [data.image.height, data.image.width]];
  L.imageOverlay(data.image.url, bounds).addTo(map);
  map.fitBounds(bounds);

  const poiLayer = L.layerGroup().addTo(map);
  const routeLayer = L.layerGroup().addTo(map);

  // ---------- UI helpers ----------
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

  // Hide directions by default
  hideDirections();

  // ---------- Math helpers ----------
  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ---------- roomsByBlock helpers ----------
  function getAllRooms() {
    const out = [];
    for (const blockKey of Object.keys(data.roomsByBlock)) {
      const arr = data.roomsByBlock[blockKey] || [];
      for (const r of arr) out.push({ code: r.code, x: r.x, y: r.y, block: blockKey });
    }
    out.sort((a, b) => String(a.code).localeCompare(String(b.code)));
    return out;
  }

  function findRoomInBlocks(code) {
    for (const blockKey of Object.keys(data.roomsByBlock)) {
      const arr = data.roomsByBlock[blockKey] || [];
      for (const r of arr) {
        if (r.code === code) return { blockKey, roomObj: r };
      }
    }
    return null;
  }

  function renderRoomsJSON() {
    if (!roomsOut) return;
    roomsOut.textContent = JSON.stringify(data.roomsByBlock, null, 2);
  }

  function refreshRoomSelectOptions() {
    if (!roomSelect) return;
    const current = roomSelect.value;
    roomSelect.innerHTML = "";
    getAllRooms().forEach(r => roomSelect.add(new Option(r.code, r.code)));
    if (current) roomSelect.value = current;
  }

  refreshRoomSelectOptions();
  renderRoomsJSON();

  // ---------- Optional: Add room codes by typing (supports 304A etc.) ----------
  function normalizeRoomCode(code) {
    const raw = (code || "").toUpperCase().replace(/\s+/g, "").trim();
    if (raw.length < 6) return null;

    const prefix = raw.slice(0, 3); // MCA/MCB/MCC
    const rest = raw.slice(3);      // 304 or 304A

    if (!/^[A-Z]{3}$/.test(prefix)) return null;
    if (!/^\d{3}[A-Z]?$/.test(rest)) return null;

    return `${prefix} ${rest}`;
  }

  function inferBlockFromCode(code) {
    // MCA -> A, MCB -> B, MCC -> C ...
    return code.slice(2, 3);
  }

  addRoomBtn?.addEventListener("click", () => {
    const norm = normalizeRoomCode(roomCodeInput?.value);
    if (!norm) return alert("Invalid code. Example: MCB 304A");

    if (getAllRooms().some(r => r.code === norm)) return alert(`${norm} already exists.`);

    const block = inferBlockFromCode(norm);
    if (!data.roomsByBlock[block]) data.roomsByBlock[block] = [];
    data.roomsByBlock[block].push({ code: norm, x: null, y: null });

    if (roomCodeInput) roomCodeInput.value = "";
    refreshRoomSelectOptions();
    renderRoomsJSON();
    if (roomSelect) roomSelect.value = norm;
  });

  roomCodeInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addRoomBtn?.click();
  });

  clearRoomsBtn?.addEventListener("click", () => {
    for (const blockKey of Object.keys(data.roomsByBlock)) {
      (data.roomsByBlock[blockKey] || []).forEach(r => { r.x = null; r.y = null; });
    }
    renderRoomsJSON();
  });

  // Click-place coordinates (only if admin mode exists)
  map.on("click", (e) => {
    if (!modeSelect || modeSelect.value !== "roomAdd") return;
    const code = roomSelect?.value;
    if (!code) return;

    const found = findRoomInBlocks(code);
    if (!found) return;

    found.roomObj.x = Math.round(e.latlng.lng);
    found.roomObj.y = Math.round(e.latlng.lat);

    renderRoomsJSON();
  });

  // ---------- POIs: washroom visibility ----------
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
    if (startResults) startResults.innerHTML = "";
    if (endResults) endResults.innerHTML = "";
  });

  drawWashrooms();

  // ---------- Search (rooms + washrooms always searchable) ----------
  function normalizeQuery(s) {
    return (s || "").toUpperCase().trim();
  }

  function getSearchItems() {
    const items = [];

    // rooms
    getAllRooms().forEach(r => items.push({ kind: "room", code: r.code, ref: r }));

    // washrooms ALWAYS searchable
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

  let selectedStart = null;
  let selectedEnd = null;

  function pickStart(item) {
    selectedStart = item;
    if (startSearch) startSearch.value = item.code;
    if (startResults) startResults.innerHTML = "";
  }

  function pickEnd(item) {
    selectedEnd = item;
    if (endSearch) endSearch.value = item.code;
    if (endResults) endResults.innerHTML = "";
  }

  startSearch?.addEventListener("input", () => {
    renderResults(startResults, doSearch(startSearch.value), pickStart);
  });

  endSearch?.addEventListener("input", () => {
    renderResults(endResults, doSearch(endSearch.value), pickEnd);
  });

  // Exact match on Enter (so you don't have to click suggestions)
  startSearch?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const typed = startSearch.value.trim();
    const exact = getSearchItems().find(it => it.code === typed);
    if (exact) pickStart(exact);
  });

  endSearch?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const typed = endSearch.value.trim();
    const exact = getSearchItems().find(it => it.code === typed);
    if (exact) pickEnd(exact);
  });

  // ---------- Routing core (snap to edge + dijkstra) ----------
  function clearRoute() {
    routeLayer.clearLayers();
    map.fitBounds(bounds);
    hideDirections();
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
      return { x: A.x, y: A.y, dist2: dx*dx + dy*dy };
    }

    let t = (APx * ABx + APy * ABy) / ab2;
    t = Math.max(0, Math.min(1, t));

    const x = A.x + t * ABx;
    const y = A.y + t * ABy;

    const dx = P.x - x, dy = P.y - y;
    return { x, y, dist2: dx*dx + dy*dy };
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

    working.edges = working.edges.filter(([a,b]) =>
      !((a===u && b===v) || (a===v && b===u))
    );

    working.edges.push([u, entryId]);
    working.edges.push([entryId, v]);
    return entryId;
  }

  function buildAdjFor(h) {
    const adj = {};
    Object.keys(h.nodes).forEach(k => (adj[k] = []));
    h.edges.forEach(([u,v]) => {
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

  // ---------- Directions (ETA + left/right) ----------
  function simplifyPoints(points, minSegmentPx = 18) {
    const out = [];
    for (const p of points) {
      if (out.length === 0) { out.push(p); continue; }
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
      d += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
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

  function routeItems(startItem, endItem) {
    routeLayer.clearLayers();

    if (!startItem || !endItem) {
      hideDirections();
      return alert("Select Start and End from suggestions (or press Enter for exact match).");
    }

    const A = getPointFromItem(startItem);
    const B = getPointFromItem(endItem);

    if (!A || !B) {
      hideDirections();
      return alert("Missing coordinates for Start/End. Click-place missing rooms or add POI coords.");
    }

    const working = cloneHallway(data.hallway);
    const sId = insertEntryNode(working, "ENTRY_START", A);
    const eId = insertEntryNode(working, "ENTRY_END", B);

    if (!sId || !eId) {
      hideDirections();
      return alert("Could not snap to hallways. Add more hallway edges near these rooms.");
    }

    const hallwayPath = dijkstraFor(working, sId, eId);
    if (!hallwayPath.length) {
      hideDirections();
      return alert("No connected hallway path found (graph disconnected).");
    }

    const coords = [
      [A.y, A.x],
      ...hallwayPath.map(id => {
        const p = working.nodes[id];
        return [p.y, p.x];
      }),
      [B.y, B.x]
    ];

    const mainLine = L.polyline(coords, { weight: 8, opacity: 0.9 }).addTo(routeLayer);

    // dashed connectors
    const sPt = working.nodes[sId];
    const ePt = working.nodes[eId];
    L.polyline([[A.y, A.x], [sPt.y, sPt.x]], { dashArray: "6 8", weight: 4, opacity: 0.85 }).addTo(routeLayer);
    L.polyline([[B.y, B.x], [ePt.y, ePt.x]], { dashArray: "6 8", weight: 4, opacity: 0.85 }).addTo(routeLayer);

    map.fitBounds(mainLine.getBounds(), { padding: [40, 40] });

    const hallwayPoints = hallwayPath.map(id => working.nodes[id]);
    const steps = buildTurnByTurn(hallwayPoints, startItem.code, endItem.code);
    setSteps(steps);
    showDirections();
  }

  // Buttons
  routeBtn.addEventListener("click", () => routeItems(selectedStart, selectedEnd));
  clearRouteBtn.addEventListener("click", clearRoute);
});