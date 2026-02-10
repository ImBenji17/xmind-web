const { useState } = React;
const e = React.createElement;

function parseHexColor(value) {
  if (!value || typeof value !== "string") return null;
  const cleaned = value.trim().replace("#", "");
  if (cleaned.length !== 6 && cleaned.length !== 8) return null;
  const hex = cleaned.slice(0, 6);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

function isRedText(style) {
  if (!style || typeof style !== "object") return false;
  const props = style.properties;
  if (!props || typeof props !== "object") return false;
  const color = parseHexColor(props["fo:color"]);
  if (!color) return false;
  const [r, g, b] = color;
  return r >= 200 && g <= 80 && b <= 80;
}

function isGreenFill(style) {
  if (!style || typeof style !== "object") return false;
  const props = style.properties;
  if (!props || typeof props !== "object") return false;
  const color = parseHexColor(props["svg:fill"]);
  if (!color) return false;
  const [r, g, b] = color;
  return g >= 160 && g >= r + 20 && g >= b + 20;
}

function iterChildTopics(children) {
  if (!children || typeof children !== "object") return [];
  const topics = [];
  Object.values(children).forEach((value) => {
    if (Array.isArray(value)) {
      topics.push(...value);
    } else if (value && typeof value === "object" && Array.isArray(value.topics)) {
      topics.push(...value.topics);
    }
  });
  return topics;
}

function cleanTitle(title) {
  if (!title || typeof title !== "string") return "Sin título";
  return title.split(/\s+/).join(" ").trim();
}

const TRANSLATIONS = {
  "画布": "Lienzo",
  "画布 1": "Lienzo 1",
};

function translateTitle(title) {
  if (!title || typeof title !== "string") return title;
  let translated = title;
  Object.entries(TRANSLATIONS).forEach(([from, to]) => {
    translated = translated.split(from).join(to);
  });
  return translated;
}

function maskEmail(text) {
  if (!text || typeof text !== "string") return text;
  return text.replace(
    /([a-zA-Z0-9._%+-]{4})[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    "$1****@$2"
  );
}

function maskPhone(text) {
  if (!text || typeof text !== "string") return text;
  return text.replace(/(\+\d{1,3})?([\s\-().]*\d[\d\s\-().]{6,}\d)/g, (match, cc, numberPart) => {
    const digits = numberPart.replace(/\D/g, "");
    if (digits.length < 7) return match;
    const country = cc ? cc.replace(/\D/g, "") : "";
    const afterCountry = digits.slice(country.length);
    const keep = afterCountry.slice(0, 3);
    const mask = afterCountry.slice(3).replace(/\d/g, "*");
    const maskedDigits = `${country}${keep}${mask}`;
    let digitIndex = 0;
    let rebuilt = "";
    const fullMasked = (cc ? "+" : "") + maskedDigits;
    for (const ch of (cc ? cc + numberPart : numberPart)) {
      if (/\d/.test(ch)) {
        rebuilt += fullMasked[digitIndex] || "*";
        digitIndex += 1;
      } else if (ch === "+" && cc) {
        rebuilt += "+";
      } else {
        rebuilt += ch;
      }
    }
    return rebuilt;
  });
}

function maskSensitive(text) {
  return maskPhone(maskEmail(text));
}

function parseGroupRow(rawTitle, totalMembers) {
  const cleaned = cleanTitle(rawTitle || "");
  const parts = cleaned.split(" ");
  const ingreso = parts[0] || "";
  const agenteRaw = parts[2] || "";
  const montoRaw = parts[3] || "";
  const nivelRaw = parts[5] || parts[4] || "";

  const agente = maskSensitive(translateTitle(agenteRaw));
  let monto = montoRaw;
  if (monto) {
    monto = monto.replace(/\\s*USDT/gi, "");
    monto = monto.replace(/U$/i, "");
    monto = monto.trim();
    if (monto) {
      monto = `${monto} USDT`;
    }
  }
  const nivel = nivelRaw;

  return {
    ingreso,
    agente,
    monto,
    nivel,
    total: totalMembers,
  };
}

function countDescendants(topic) {
  let count = 0;
  const children = iterChildTopics(topic.children);
  children.forEach((child) => {
    if (!isRedText(child.style)) {
      count += 1;
    }
    count += countDescendants(child);
  });
  return count;
}

function collectGreenGroups(root, sheetTitle) {
  const groups = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (isGreenFill(node.style)) {
      groups.push({
        sheet: sheetTitle,
        title: cleanTitle(node.title),
        count: countDescendants(node),
      });
    }
    iterChildTopics(node.children).forEach((child) => stack.push(child));
  }
  return groups;
}

function parseXmlCounts(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const sheetNodes = Array.from(
    doc.getElementsByTagNameNS("urn:xmind:xmap:xmlns:content:2.0", "sheet")
  );
  return sheetNodes.map((sheet) => {
    const titleNode = sheet.getElementsByTagNameNS(
      "urn:xmind:xmap:xmlns:content:2.0",
      "title"
    )[0];
    const title = titleNode ? titleNode.textContent : "Sin título";
    const topics = sheet.getElementsByTagNameNS("urn:xmind:xmap:xmlns:content:2.0", "topic");
    const childCount = Math.max(topics.length - 1, 0);
    return { sheet: title, childCount };
  });
}

function App() {
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setResults(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);

      if (zip.file("content.json")) {
        const jsonText = await zip.file("content.json").async("string");
        const sheets = JSON.parse(jsonText);
        const sheetResults = [];
        let total = 0;
        let greenGroups = [];

        sheets.forEach((sheet) => {
          const title = sheet.title || "Sin título";
          const root = sheet.rootTopic || {};
          const childCount = countDescendants(root);
          sheetResults.push({ sheet: title, childCount });
          total += childCount;
          greenGroups = greenGroups.concat(collectGreenGroups(root, title));
        });

        greenGroups.sort((a, b) => b.count - a.count);

        setResults({
          format: "json",
          sheetResults,
          total,
          greenGroups,
          notes: [],
        });
        return;
      }

      if (zip.file("content.xml")) {
        const xmlText = await zip.file("content.xml").async("string");
        const sheetResults = parseXmlCounts(xmlText);
        const total = sheetResults.reduce((sum, item) => sum + item.childCount, 0);
        setResults({
          format: "xml",
          sheetResults,
          total,
          greenGroups: [],
          notes: [
            "Este archivo usa content.xml. Los estilos son limitados, por lo que el filtrado rojo/verde puede no estar disponible.",
          ],
        });
        return;
      }

      throw new Error("Formato .xmind no compatible (falta content.json/xml)");
    } catch (err) {
      setError(err.message || "No se pudo procesar el archivo");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    const target = document.getElementById("results");
    if (!target) return;
    const options = {
      margin: 10,
      filename: `reporte-xmind-${Date.now()}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: "#0c0f1a" },
      jsPDF: { unit: "pt", format: "a4", orientation: "portrait" },
    };
    html2pdf().set(options).from(target).save();
  };

  return e(
    "div",
    { className: "app" },
    e(
      "div",
      { className: "hero" },
      e("span", { className: "badge" }, "HERRAMIENTAS XMIND - XDCBIT"),
      e("h1", null, "Contador de Miembros XMind - XDCBIT"),
      e(
        "p",
        { className: "subtitle" },
        "Sube un archivo XMind y obtén conteos por agente, el total excluye a los miembros que salieron del equipo (texto en rojo)."
      )
    ),
    e(
      "div",
      { className: "card" },
      e(
        "div",
        { className: "controls" },
        e("input", { type: "file", accept: ".xmind", onChange: handleFile }),
        e(
          "button",
          { className: "button", onClick: downloadPdf, disabled: !results || loading },
          "Descargar PDF"
        ),
        e(
          "button",
          {
            className: "button secondary",
            disabled: loading,
            onClick: () => {
              setResults(null);
              setError("");
              setFileName("");
            },
          },
          "Reiniciar"
        )
      ),
      loading ? e("div", { className: "note" }, "Procesando archivo...") : null,
      error ? e("div", { className: "note error" }, error) : null,
      results
        ? e(
            "div",
            { id: "results", className: "grid" },
            e("div", { className: "note" }, e("strong", null, "Archivo:"), " ", fileName),
            results.notes.map((note, index) =>
              e("div", { className: "note", key: index }, note)
            ),
            e(
              "div",
              null,
              e("p", { className: "section-title" }, "Cantidad de miembros total"),
              e(
                "div",
                { className: "kv" },
                e(
                  "div",
                  { className: "kv-item" },
                  e("span", null, "Total de miembros"),
                  e("strong", null, results.total)
                )
              )
            ),
            e(
              "div",
              null,
              e("p", { className: "section-title" }, "Cantidad de miembros por agente"),
              results.greenGroups.length === 0
                ? e("div", { className: "note" }, "No se encontraron nodos con fondo verde.")
                : e(
                    "div",
                    { className: "list" },
                    e(
                      "table",
                      { className: "table" },
                      e(
                        "thead",
                        null,
                        e(
                          "tr",
                          null,
                          e("th", null, "Fecha de ingreso"),
                          e("th", null, "Agente"),
                          e("th", null, "Monto invertido"),
                          e("th", null, "Nivel"),
                          e("th", null, "Total miembros")
                        )
                      ),
                      e(
                        "tbody",
                        null,
                        results.greenGroups.map((group, index) => {
                          const row = parseGroupRow(group.title, group.count);
                          return e(
                            "tr",
                            { key: `${group.sheet}-${index}` },
                            e("td", null, row.ingreso),
                            e("td", null, row.agente),
                            e("td", null, row.monto),
                            e("td", null, row.nivel),
                            e("td", null, row.total)
                          );
                        })
                      )
                    )
                  )
            )
          )
        : null
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(e(App));
