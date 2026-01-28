document.addEventListener("DOMContentLoaded", () => {
  const data = window.LEVEL3;
  if (!data) {
    console.error("LEVEL3 not found. Load data-level3.js before app.js");
    return;
  }

  // Ensure arrays exist
  if (!Array.isArray(data.rooms)) data.rooms = [];
  if (!Array.isArray(data.pois)) data.pois = [];

  // =========================
  // UI (Search)
  // =========================
  const startSearch = document.getElementById("startSearch");
  const endSearch = document.getElementById("endSearch");
  const startResults = document.getElementById("startResults");
  const endResults = document.getElementById("endResults");

  const routeBtn = document.getElementById("routeBtn");
  const clearRouteBtn = document.getElementById("clearRouteBtn");
  const stepsOl = document.getElementById("steps");

  // Filters (we implement washroom now)
  const filterWashroom = document.getElementById("filterWashroom");
  // (photocopy/electrical can be added later the same way)

  // Optional room placement UI you already have
  const modeSelect = document.getElementById("modeSelect");   // route | roomAdd
  const roomSelect = document.getElementById("roomSelect");
  const roomCodeInput = document.getElementById("roomCodeInput");
  const addRoomBtn = document.getElementById("addRoomBtn");
  const clearRoomsBtn = document.getElementById("clearRoomsBtn");
  const roomsOut = document.getElementById("roomsOut");

  // =========================
  // MAP INIT
  // =========================
  const map = L.map("chownMap", { crs: L.CRS.Simple, minZoom: -2, maxZoom: 4 });
  const bounds = [[0, 0], [data.image.height, data.image.width]];
  L.imageOverlay(data.image.url, bounds).addTo(map);
  map.fitBounds(bounds);

  const hallwayLayer = L.layerGroup().addTo(map);
  const roomLayer = L.layerGroup().addTo(map);
  const poiLayer = L.layerGroup().addTo(map);
  const routeLayer = L.layerGroup().addTo(map);

  // =========================
  // HELPERS
  // =========================
  function setSteps(lines) {
    stepsOl.innerHTML = "";
    lines.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      stepsOl.appendChild(li);
    });
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function roomIcon(text) {
    return L.divIcon({
      className: "",
      html: `
        <div style="
          padding:6px 10px;border-radius:999px;
          background:#fff;border:2px solid #111;
          font-weight:700;font-size:12px;color:#111;
          box-shadow:0 4px 10px rgba(0,0,0,.25);
          white-space:nowrap;
        ">${text}</div>
      `,
      iconSize: [1, 1],
      iconAnchor: [0, 0],
    });
  }

  function poiIcon(label, type) {
    const bg = type === "washroom" ? "#1976d2" : "#444";
    return L.divIcon({
      className: "",
      html: `
        <div style="
          padding:6px 10px;border-radius:999px;
          background:${bg};border:2px solid #111;
          font-weight:800;font-size:12px;color:#fff;
          box-shadow:0 4px 10px rgba(0,0,0,.25);
          white-space:nowrap;
        ">${label}</div>
      `,
      iconSize: [1, 1],
      iconAnchor: [0, 0],
    });
  }

  function entryIcon() {
    return L.divIcon({
      className: "",
      html: `
        <div style="
          width:12px;height:12px;border-radius:999px;
          background:#111;border:2px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,.25);
        "></div>
      `,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  }

  // =========================
  // HALLWAYS
  // =========================
  // Hallway visuals disabled for clean UI
function drawHallwaysVisual() {
  hallwayLayer.clearLayers();
}
// drawHallwaysVisual(); //


  // =========================
  // DRAW ROOMS + POIs
  // =========================
  function renderRoomsJSON() {
    if (!roomsOut) return;
    roomsOut.textContent = JSON.stringify(data.rooms, null, 2);
  }

  function refreshRoomSelect() {
    if (!roomSelect) return;
    const current = roomSelect.value;
    roomSelect.innerHTML = "";
    data.rooms.forEach((r) => roomSelect.add(new Option(r.code, r.code)));
    if (current && data.rooms.some(r => r.code === current)) roomSelect.value = current;
  }

  // Classroom markers disabled for clean UI
function drawRooms() {
  roomLayer.clearLayers();
}


  function drawPois() {
    poiLayer.clearLayers();
    data.pois.forEach((p) => {
      if (p.x == null || p.y == null) return;
      L.marker([p.y, p.x], { icon: poiIcon(p.label, p.type) })
        .addTo(poiLayer)
        .bindPopup(`<b>${p.label}</b><br>Type: ${p.type}`);
    });
  }

  drawRooms();
  drawPois();
  refreshRoomSelect();
  renderRoomsJSON();

  // =========================
  // ADD ROOMS BY TYPING (optional)
  // =========================
  function normalizeRoomCode(code) {
    const c = (code || "").toUpperCase().replace(/\s+/g, "").trim();
    if (c.length < 6) return null;
    const prefix = c.slice(0, 3);
    const num = c.slice(3);
    if (!/^[A-Z]{3}$/.test(prefix)) return null;
    if (!/^\d{3}$/.test(num)) return null;
    return `${prefix} ${num}`;
  }

  function addRoomCode(codeRaw) {
    const code = normalizeRoomCode(codeRaw);
    if (!code) { alert("Invalid room code. Use MCA 302"); return null; }
    if (data.rooms.some(r => r.code === code)) { alert(`${code} already exists`); return null; }
    const newRoom = { code, x: null, y: null };
    data.rooms.push(newRoom);
    refreshRoomSelect();
    renderRoomsJSON();
    return newRoom;
  }

  addRoomBtn?.addEventListener("click", () => {
    const added = addRoomCode(roomCodeInput?.value);
    if (added && roomSelect) roomSelect.value = added.code;
    if (roomCodeInput) roomCodeInput.value = "";
  });

  roomCodeInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addRoomBtn?.click();
  });

  // click-place rooms
  map.on("click", (e) => {
    if (!modeSelect || modeSelect.value !== "roomAdd") return;
    const code = roomSelect?.value;
    if (!code) return;

    const r = data.rooms.find(rr => rr.code === code);
    if (!r) return;

    r.x = Math.round(e.latlng.lng);
    r.y = Math.round(e.latlng.lat);

    drawRooms();
    renderRoomsJSON();
  });

  clearRoomsBtn?.addEventListener("click", () => {
    data.rooms.forEach(r => { r.x = null; r.y = null; });
    drawRooms();
    renderRoomsJSON();
  });

  // =========================
  // ROUTING CORE (snap to edge)
  // =========================
  function closestPointOnSegment(P, A, B) {
    const ABx = B.x - A.x, ABy = B.y - A.y;
    const APx = P.x - A.x, APy = P.y - A.y;

    const ab2 = ABx * ABx + ABy * ABy;
    if (ab2 === 0) {
      const dx = P.x - A.x, dy = P.y - A.y;
      return { x: A.x, y: A.y, t: 0, dist2: dx * dx + dy * dy };
    }

    let t = (APx * ABx + APy * ABy) / ab2;
    t = Math.max(0, Math.min(1, t));

    const x = A.x + t * ABx;
    const y = A.y + t * ABy;

    const dx = P.x - x, dy = P.y - y;
    return { x, y, t, dist2: dx * dx + dy * dy };
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

  function insertEntryNode(workingHallway, entryId, point) {
    const snap = snapPointToHallwayEdge(workingHallway, point);
    if (!snap) return null;

    const { u, v, proj } = snap;
    workingHallway.nodes[entryId] = { x: proj.x, y: proj.y };

    workingHallway.edges = workingHallway.edges.filter(([a,b]) =>
      !((a === u && b === v) || (a === v && b === u))
    );

    workingHallway.edges.push([u, entryId]);
    workingHallway.edges.push([entryId, v]);

    return entryId;
  }

  function buildAdjFor(hallway) {
    const adj = {};
    Object.keys(hallway.nodes).forEach(k => (adj[k] = []));
    hallway.edges.forEach(([u,v]) => {
      const w = dist(hallway.nodes[u], hallway.nodes[v]);
      adj[u].push({ to: v, w });
      adj[v].push({ to: u, w });
    });
    return adj;
  }

  function dijkstraFor(hallway, start, end) {
    const adj = buildAdjFor(hallway);
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

  // =========================
  // SEARCH
  // =========================
  function normalizeQuery(s) {
    return (s || "").toUpperCase().trim();
  }

  function getAllSearchItems() {
    // Rooms always searchable
    const items = data.rooms.map(r => ({ kind: "room", code: r.code, ref: r }));

    // POIs searchable if filter allows
    const wantWashrooms = !!filterWashroom?.checked;

    // If no filters checked, show all POIs. If washroom checked, show washrooms.
    const anyFilter = wantWashrooms;
    const poisToShow = anyFilter
      ? data.pois.filter(p => (wantWashrooms ? p.type === "washroom" : true))
      : data.pois;

    poisToShow.forEach(p => items.push({ kind: "poi", code: p.label, ref: p }));

    return items;
  }

  function search(items, q) {
    if (!q) return [];
    const qq = normalizeQuery(q);
    return items
      .filter(it => normalizeQuery(it.code).includes(qq))
      .slice(0, 8);
  }

  function renderResults(container, results, onPick) {
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

  // selected objects can be room or poi
  let selectedStart = null; // {kind, code, ref}
  let selectedEnd = null;

  function pickStart(item) {
    selectedStart = item;
    startSearch.value = item.code;
    startResults.innerHTML = "";
  }

  function pickEnd(item) {
    selectedEnd = item;
    endSearch.value = item.code;
    endResults.innerHTML = "";
  }

  startSearch.addEventListener("input", () => {
    const items = getAllSearchItems();
    const results = search(items, startSearch.value);
    renderResults(startResults, results, pickStart);
  });

  endSearch.addEventListener("input", () => {
    const items = getAllSearchItems();
    const results = search(items, endSearch.value);
    renderResults(endResults, results, pickEnd);
  });

  // When filter changes, clear results so you see updated list
  filterWashroom?.addEventListener("change", () => {
    startResults.innerHTML = "";
    endResults.innerHTML = "";
  });

  // =========================
  // ROUTING
  // =========================
  function clearRoute() {
    routeLayer.clearLayers();
    stepsOl.innerHTML = "";
    map.fitBounds(bounds);
  }

  function getPointFromItem(item) {
    if (!item) return null;
    const p = item.ref;
    if (p.x == null || p.y == null) return null;
    return { x: p.x, y: p.y };
  }

  function routeItems(startItem, endItem) {
    clearRoute();

    const A = getPointFromItem(startItem);
    const B = getPointFromItem(endItem);

    if (!startItem || !endItem) {
      setSteps(["Pick Start and End from the search results first."]);
      return;
    }

    if (!A || !B) {
      setSteps([
        "Missing coordinates for Start/End.",
        "Make sure rooms are placed and washrooms have x/y in data-level3.js."
      ]);
      return;
    }

    const working = cloneHallway(data.hallway);
    const sId = insertEntryNode(working, "ENTRY_START", A);
    const eId = insertEntryNode(working, "ENTRY_END", B);

    if (!sId || !eId) {
      setSteps(["Could not snap to hallway edges. Check hallway coverage."]);
      return;
    }

    const hallwayPath = dijkstraFor(working, sId, eId);
    if (!hallwayPath.length) {
      setSteps(["No connected hallway path found."]);
      return;
    }

    const coords = [
      [A.y, A.x],
      ...hallwayPath.map(id => {
        const p = working.nodes[id];
        return [p.y, p.x];
      }),
      [B.y, B.x],
    ];

    const mainLine = L.polyline(coords, { weight: 8, opacity: 0.9 }).addTo(routeLayer);

    // dashed connectors
    const sPt = working.nodes[sId];
    const ePt = working.nodes[eId];

    L.polyline([[A.y, A.x], [sPt.y, sPt.x]], { dashArray: "6 8", weight: 4, opacity: 0.85 }).addTo(routeLayer);
    L.polyline([[B.y, B.x], [ePt.y, ePt.x]], { dashArray: "6 8", weight: 4, opacity: 0.85 }).addTo(routeLayer);

    // entry dots
    // L.marker([startEntryPt.y, startEntryPt.x], { icon: entryIcon() }).addTo(routeLayer);
    // L.marker([endEntryPt.y, endEntryPt.x], { icon: entryIcon() }).addTo(routeLayer);


    map.fitBounds(mainLine.getBounds(), { padding: [40, 40] });

    setSteps([
      `Start: ${startItem.code}`,
      `Go through hallways`,
      `Arrive: ${endItem.code}`
    ]);
  }

  routeBtn.addEventListener("click", () => routeItems(selectedStart, selectedEnd));
  clearRouteBtn.addEventListener("click", clearRoute);
});

