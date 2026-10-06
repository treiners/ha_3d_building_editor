function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}
export function renderEditableInspectionHtml(svg, model, sourceDocument, options = {}) {
    const title = options.title ?? "Interactive Openings Editor";
    const step = options.step ?? 0.1;
    const debug = options.debug ?? false;
    const recordsJson = JSON.stringify(model.byKey).replaceAll("<", "\\u003c");
    const sourceJson = JSON.stringify(sourceDocument).replaceAll("<", "\\u003c");
    // This function returns an HTML document using a TypeScript template literal.
    // The embedded browser script therefore avoids JavaScript template literals.
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{margin:0;font:14px system-ui,sans-serif;background:#eef2f6;color:#17202a;display:grid;grid-template-columns:minmax(0,1fr) 340px;min-height:100vh}
main{padding:20px;overflow:auto}
aside{background:#fff;border-left:1px solid #d7dde5;padding:20px}
svg{max-width:100%;height:auto;background:#fff}
.inspectable{cursor:pointer}
.selected{filter:drop-shadow(0 0 5px #f59e0b)}
label{display:block;font-weight:700;margin-top:12px}
input{width:100%;box-sizing:border-box;padding:7px}
button{margin-top:12px;padding:8px 10px}
pre{white-space:pre-wrap;font-size:12px;background:#f7f8fa;padding:10px}
.hint{color:#667085}
.error{color:#b42318;background:#fef3f2;padding:10px;border-radius:4px}
</style>
</head>
<body>
<main>${svg}</main>
<aside>
<h1>Inspector</h1>
<div id="details" class="hint">Select a room, wall, connector, or window.</div>
<div id="editor" hidden>
<label for="offset">Offset (metres)</label>
<input id="offset" type="number" step="${step}">
<button id="apply" type="button">Apply offset</button>
<button id="download" type="button">Download updated JSON</button>
<p class="hint">Movement is constrained to the current boundary. Validation remains authoritative.</p>
</div>
</aside>
<script>
const records = ${recordsJson};
const source = ${sourceJson};
const debug = ${debug ? "true" : "false"};
const details = document.getElementById("details");
const editor = document.getElementById("editor");
const offsetInput = document.getElementById("offset");
const applyButton = document.getElementById("apply");
const downloadButton = document.getElementById("download");
let selected = null;

function lookup(type, id) {
  const key = type + ":" + id;
  return records[key];
}

function renderRecord(record, type, id) {
  if (!record) {
    editor.hidden = true;
    details.className = "error";
    details.textContent = "No inspection record found. Type: " + type + "; ID: " + id;
    return;
  }

  details.className = "";
  const heading = document.createElement("h2");
  heading.textContent = record.title;

  const typeParagraph = document.createElement("p");
  typeParagraph.textContent = "Type: " + record.type;

  const list = document.createElement("dl");
  for (const entry of Object.entries(record.properties)) {
    const name = entry[0];
    const value = entry[1];
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = name;
    description.textContent = Array.isArray(value) ? value.join(", ") : String(value);
    list.append(term, description);
  }

  details.replaceChildren(heading, typeParagraph, list);
}

function findSource(type, id) {
  const floor = source.building.floors[0];
  if (type === "connector") {
    return (floor.connectors || []).find(function (item) { return item.id === id; });
  }
  if (type === "window") {
    return (floor.openings || []).find(function (item) { return item.id === id; });
  }
  return undefined;
}

function findBoundary(boundaryId) {
  const floor = source.building.floors[0];
  for (const room of floor.rooms) {
    const edge = (room.boundaries || []).find(function (boundary) {
      return boundary.id === boundaryId;
    });
    if (edge) return { room: room, edge: edge };
  }
  return undefined;
}

function updateLine(element, requestedOffset) {
  const boundaryId = element.dataset.editBoundary;
  const match = findBoundary(boundaryId);
  if (!match) {
    details.className = "error";
    details.textContent = "Boundary not found: " + boundaryId;
    return;
  }

  const shape = match.room.geometry.shape;
  const edgeIndex = match.edge.edgeIndex;
  const a = shape[edgeIndex];
  const b = shape[(edgeIndex + 1) % shape.length];
  const boundaryLength = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const width = Number(element.dataset.editWidth);
  const maximumOffset = Math.max(0, boundaryLength - width);
  const boundedOffset = Math.max(0, Math.min(maximumOffset, requestedOffset));

  const pointAt = function (distance) {
    return {
      x: a[0] + (b[0] - a[0]) * distance / boundaryLength,
      y: a[1] + (b[1] - a[1]) * distance / boundaryLength,
    };
  };

  const svgElement = document.querySelector("svg");
  const viewBox = svgElement.viewBox.baseVal;
  const allPoints = source.building.floors[0].rooms.flatMap(function (room) {
    return room.geometry.shape;
  });
  const minX = Math.min.apply(null, allPoints.map(function (point) { return point[0]; }));
  const maxX = Math.max.apply(null, allPoints.map(function (point) { return point[0]; }));
  const minY = Math.min.apply(null, allPoints.map(function (point) { return point[1]; }));
  const maxY = Math.max.apply(null, allPoints.map(function (point) { return point[1]; }));
  const padding = 32;
  const scaleX = (viewBox.width - padding * 2) / (maxX - minX);
  const scaleY = (viewBox.height - padding * 2) / (maxY - minY);
  const scale = Math.min(scaleX, scaleY);

  const toSvg = function (point) {
    return {
      x: (point.x - minX) * scale + padding,
      y: (point.y - minY) * scale + padding,
    };
  };

  const start = toSvg(pointAt(boundedOffset));
  const end = toSvg(pointAt(boundedOffset + width));
  element.setAttribute("x1", String(start.x));
  element.setAttribute("y1", String(start.y));
  element.setAttribute("x2", String(end.x));
  element.setAttribute("y2", String(end.y));
  element.dataset.editOffset = String(boundedOffset);

  const type = element.dataset.inspectType;
  const id = element.dataset.inspectId;
  const sourceItem = findSource(type, id);
  if (sourceItem) sourceItem.offset = boundedOffset;

  const record = lookup(type, id);
  if (record && record.properties) record.properties.offset = boundedOffset;
  offsetInput.value = String(boundedOffset);
  renderRecord(record, type, id);
}

// Event delegation handles rooms, walls, connectors, and windows, including
// SVG elements added after the original renderer created the document.
document.addEventListener("click", function (event) {
  const rawTarget = event.target;
  if (!(rawTarget instanceof Element)) return;

  const target = rawTarget.closest("[data-inspect-type][data-inspect-id]");
  if (!target) return;

  event.stopPropagation();
  if (selected) selected.classList.remove("selected");
  selected = target;
  selected.classList.add("selected");

  const type = target.dataset.inspectType;
  const id = target.dataset.inspectId;
  if (!type || !id) return;

  if (debug) console.log("Selected", type, id);
  const record = lookup(type, id);
  renderRecord(record, type, id);

  const editable = type === "connector" || type === "window";
  editor.hidden = !editable || !record;
  if (editable && record) {
    const sourceItem = findSource(type, id);
    offsetInput.value = target.dataset.editOffset || String(sourceItem ? sourceItem.offset : 0);
  }
});

applyButton.addEventListener("click", function () {
  if (!selected) return;
  const value = Number(offsetInput.value);
  if (!Number.isFinite(value)) {
    details.className = "error";
    details.textContent = "Offset must be a finite number.";
    return;
  }
  updateLine(selected, value);
});

downloadButton.addEventListener("click", function () {
  const blob = new Blob([JSON.stringify(source, null, 2)], { type: "application/json" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = "reference-apartment-edited.json";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
});
</script>
</body>
</html>`;
}
