export interface XmlValidationResult {
  valid: boolean;
  error?: string;
  rootTag?: string;
  elementCount: number;
  doc?: Document;
}

export const SAMPLE_XML_DOC = `<?xml version="1.0" encoding="UTF-8"?>
<printStudio brand="SUN-NOVA PRINT SERVICE" currency="INR">
  <orders>
    <order id="ORD-1001" status="Ready">
      <customer>Aarav Sharma</customer>
      <service>Passport Photo Sheet (42 on A4)</service>
      <quantity>2</quantity>
      <dpi>300</dpi>
      <notes>White background with 2px solid cut outline</notes>
    </order>
    <order id="ORD-1002" status="Processing">
      <customer>Priya Nair</customer>
      <service>Aadhaar &amp; PAN Xerox Sheet</service>
      <quantity>5</quantity>
      <dpi>300</dpi>
      <notes>B&amp;W Xerox high contrast, CR80 card size</notes>
    </order>
    <order id="ORD-1003" status="Completed">
      <customer>Rohan Verma</customer>
      <service>Business Card Printing (350gsm Matte)</service>
      <quantity>500</quantity>
      <dpi>300</dpi>
      <notes>Full Color CMYK double-sided</notes>
    </order>
  </orders>
</printStudio>`;

export function validateXmlInput(xmlText: string): XmlValidationResult {
  const trimmed = xmlText.trim();
  if (!trimmed) {
    return { valid: false, error: "Enter or upload XML content to convert.", elementCount: 0 };
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(trimmed, "application/xml");
  const parseErr = doc.querySelector("parsererror");
  if (parseErr) {
    const rawMsg = (parseErr.textContent || "Malformed XML syntax.")
      .replace(/\s+/g, " ")
      .trim();
    return {
      valid: false,
      error: rawMsg.slice(0, 240),
      elementCount: 0,
    };
  }
  const root = doc.documentElement;
  if (!root) {
    return { valid: false, error: "No root XML element found.", elementCount: 0 };
  }
  const elementCount = doc.getElementsByTagName("*").length;
  return {
    valid: true,
    rootTag: root.tagName,
    elementCount,
    doc,
  };
}

function escapeXmlText(val: string): string {
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlAttr(val: string): string {
  return escapeXmlText(val).replace(/"/g, "&quot;");
}

function serializePrettyNode(node: Node, depth: number, indentUnit: string): string {
  const indent = indentUnit.repeat(depth);

  if (node.nodeType === Node.TEXT_NODE) {
    const txt = (node.textContent || "").trim();
    return txt ? `${indent}${escapeXmlText(txt)}` : "";
  }
  if (node.nodeType === Node.CDATA_SECTION_NODE) {
    return `${indent}<![CDATA[${node.textContent || ""}]]>`;
  }
  if (node.nodeType === Node.COMMENT_NODE) {
    return `${indent}<!-- ${(node.textContent || "").trim()} -->`;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const el = node as Element;
  const attrs = Array.from(el.attributes)
    .map((a) => `${a.name}="${escapeXmlAttr(a.value)}"`)
    .join(" ");
  const openTag = attrs ? `<${el.tagName} ${attrs}>` : `<${el.tagName}>`;

  const meaningfulChildren = Array.from(el.childNodes).filter((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      return (child.textContent || "").trim().length > 0;
    }
    return (
      child.nodeType === Node.ELEMENT_NODE ||
      child.nodeType === Node.CDATA_SECTION_NODE ||
      child.nodeType === Node.COMMENT_NODE
    );
  });

  if (meaningfulChildren.length === 0) {
    return attrs ? `${indent}<${el.tagName} ${attrs} />` : `${indent}<${el.tagName} />`;
  }

  if (
    meaningfulChildren.length === 1 &&
    meaningfulChildren[0].nodeType === Node.TEXT_NODE
  ) {
    const inlineText = escapeXmlText((meaningfulChildren[0].textContent || "").trim());
    return `${indent}${openTag}${inlineText}</${el.tagName}>`;
  }

  const innerLines = meaningfulChildren
    .map((c) => serializePrettyNode(c, depth + 1, indentUnit))
    .filter(Boolean);

  return `${indent}${openTag}\n${innerLines.join("\n")}\n${indent}</${el.tagName}>`;
}

export function formatXmlPretty(xmlText: string, indentUnit = "  "): string {
  const res = validateXmlInput(xmlText);
  if (!res.valid || !res.doc) {
    throw new Error(res.error || "Invalid XML.");
  }
  const hasDecl = /^\s*<\?xml\b/i.test(xmlText);
  const decl = hasDecl ? '<?xml version="1.0" encoding="UTF-8"?>\n' : "";
  return `${decl}${serializePrettyNode(res.doc.documentElement, 0, indentUnit)}`;
}

function serializeMinifiedNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeXmlText((node.textContent || "").trim());
  }
  if (node.nodeType === Node.CDATA_SECTION_NODE) {
    return `<![CDATA[${node.textContent || ""}]]>`;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  const el = node as Element;
  const attrs = Array.from(el.attributes)
    .map((a) => `${a.name}="${escapeXmlAttr(a.value)}"`)
    .join(" ");
  const meaningfulChildren = Array.from(el.childNodes).filter((c) => {
    if (c.nodeType === Node.TEXT_NODE) return (c.textContent || "").trim().length > 0;
    return c.nodeType === Node.ELEMENT_NODE || c.nodeType === Node.CDATA_SECTION_NODE;
  });
  if (meaningfulChildren.length === 0) {
    return attrs ? `<${el.tagName} ${attrs}/>` : `<${el.tagName}/>`;
  }
  const openTag = attrs ? `<${el.tagName} ${attrs}>` : `<${el.tagName}>`;
  const inner = meaningfulChildren.map(serializeMinifiedNode).join("");
  return `${openTag}${inner}</${el.tagName}>`;
}

export function minifyXml(xmlText: string): string {
  const res = validateXmlInput(xmlText);
  if (!res.valid || !res.doc) {
    throw new Error(res.error || "Invalid XML.");
  }
  const hasDecl = /^\s*<\?xml\b/i.test(xmlText);
  const decl = hasDecl ? '<?xml version="1.0" encoding="UTF-8"?>' : "";
  return `${decl}${serializeMinifiedNode(res.doc.documentElement)}`;
}

function elementToJsObject(el: Element): unknown {
  const obj: Record<string, unknown> = {};

  if (el.attributes.length > 0) {
    const attrMap: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      attrMap[attr.name] = attr.value;
    }
    obj["@attributes"] = attrMap;
  }

  const childElements = Array.from(el.children);
  const directText = Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE || n.nodeType === Node.CDATA_SECTION_NODE)
    .map((n) => (n.textContent || "").trim())
    .filter(Boolean)
    .join(" ");

  if (childElements.length === 0) {
    if (el.attributes.length === 0) {
      return directText;
    }
    if (directText) {
      obj["#text"] = directText;
    }
    return obj;
  }

  if (directText) {
    obj["#text"] = directText;
  }

  for (const child of childElements) {
    const key = child.tagName;
    const val = elementToJsObject(child);
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const existing = obj[key];
      if (Array.isArray(existing)) {
        existing.push(val);
      } else {
        obj[key] = [existing, val];
      }
    } else {
      obj[key] = val;
    }
  }

  return obj;
}

export function xmlToJsonString(xmlText: string, indentSpaces = 2): string {
  const res = validateXmlInput(xmlText);
  if (!res.valid || !res.doc) {
    throw new Error(res.error || "Invalid XML.");
  }
  const root = res.doc.documentElement;
  const output = {
    [root.tagName]: elementToJsObject(root),
  };
  return JSON.stringify(output, null, indentSpaces);
}

function csvEscapeCell(val: string): string {
  if (/[",\n\r]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function flattenElementRecord(el: Element, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const attr of Array.from(el.attributes)) {
    const col = prefix ? `${prefix}.@${attr.name}` : `@${attr.name}`;
    out[col] = attr.value;
  }
  const children = Array.from(el.children);
  if (children.length === 0) {
    const key = prefix || el.tagName;
    out[key] = (el.textContent || "").trim();
    return out;
  }

  const tagCounts: Record<string, number> = {};
  for (const ch of children) {
    tagCounts[ch.tagName] = (tagCounts[ch.tagName] || 0) + 1;
  }
  const seenCounts: Record<string, number> = {};
  for (const ch of children) {
    const total = tagCounts[ch.tagName];
    const idx = (seenCounts[ch.tagName] || 0) + 1;
    seenCounts[ch.tagName] = idx;
    const nextSeg = total > 1 ? `${ch.tagName}[${idx}]` : ch.tagName;
    const nextPrefix = prefix ? `${prefix}.${nextSeg}` : nextSeg;
    flattenElementRecord(ch, nextPrefix, out);
  }
  return out;
}

function findBestRepeatingRows(root: Element): Element[] {
  // Prefer direct child list container if root has single wrapper like <orders><order/>...</orders>
  const queue: Element[] = [root];
  let bestGroup: Element[] = [];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const children = Array.from(curr.children);
    const groups = new Map<string, Element[]>();
    for (const ch of children) {
      const arr = groups.get(ch.tagName) || [];
      arr.push(ch);
      groups.set(ch.tagName, arr);
    }
    for (const [, arr] of groups) {
      if (arr.length > bestGroup.length && arr.length >= 2) {
        bestGroup = arr;
      }
    }
    if (bestGroup.length >= 2) break;
    for (const ch of children) queue.push(ch);
  }

  if (bestGroup.length >= 2) return bestGroup;
  const direct = Array.from(root.children);
  return direct.length > 0 ? direct : [root];
}

export function xmlToCsvString(xmlText: string): string {
  const res = validateXmlInput(xmlText);
  if (!res.valid || !res.doc) {
    throw new Error(res.error || "Invalid XML.");
  }
  const rowElements = findBestRepeatingRows(res.doc.documentElement);
  const rows = rowElements.map((el) => flattenElementRecord(el));

  const headerSet = new Set<string>();
  for (const r of rows) {
    for (const key of Object.keys(r)) {
      headerSet.add(key);
    }
  }
  const headers = Array.from(headerSet);
  if (headers.length === 0) {
    throw new Error("No tabular fields found in XML document.");
  }

  const lines: string[] = [headers.map(csvEscapeCell).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscapeCell(r[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

function renderNodeAsText(el: Element, depth = 0, lines: string[] = []): string[] {
  const indent = "  ".repeat(depth);
  const attrs = Array.from(el.attributes)
    .map((a) => `${a.name}=${a.value}`)
    .join(", ");
  const attrStr = attrs ? ` (${attrs})` : "";

  const children = Array.from(el.children);
  const directText = Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE || n.nodeType === Node.CDATA_SECTION_NODE)
    .map((n) => (n.textContent || "").trim())
    .filter(Boolean)
    .join(" ");

  if (children.length === 0) {
    lines.push(`${indent}${el.tagName}${attrStr}: ${directText || "(empty)"}`);
    return lines;
  }

  lines.push(`${indent}${el.tagName}${attrStr}`);
  if (directText) {
    lines.push(`${indent}  text: ${directText}`);
  }
  for (const child of children) {
    renderNodeAsText(child, depth + 1, lines);
  }
  return lines;
}

export function xmlToPlainText(xmlText: string): string {
  const res = validateXmlInput(xmlText);
  if (!res.valid || !res.doc) {
    throw new Error(res.error || "Invalid XML.");
  }
  return renderNodeAsText(res.doc.documentElement).join("\n");
}

function sanitizeXmlTagName(raw: string, fallback = "item"): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_.-]/g, "_");
  if (!cleaned) return fallback;
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

function jsValueToXmlLines(
  tagName: string,
  val: unknown,
  depth: number,
  indentUnit: string
): string[] {
  const safeTag = sanitizeXmlTagName(tagName);
  const indent = indentUnit.repeat(depth);

  if (val === null || val === undefined) {
    return [`${indent}<${safeTag} />`];
  }
  if (Array.isArray(val)) {
    const out: string[] = [];
    for (const item of val) {
      out.push(...jsValueToXmlLines(safeTag, item, depth, indentUnit));
    }
    return out;
  }
  if (typeof val !== "object") {
    return [`${indent}<${safeTag}>${escapeXmlText(String(val))}</${safeTag}>`];
  }

  const record = val as Record<string, unknown>;
  const attrsObj =
    record["@attributes"] && typeof record["@attributes"] === "object"
      ? (record["@attributes"] as Record<string, unknown>)
      : null;
  const attrsStr = attrsObj
    ? Object.entries(attrsObj)
        .map(([k, v]) => `${sanitizeXmlTagName(k, "attr")}="${escapeXmlAttr(String(v ?? ""))}"`)
        .join(" ")
    : "";

  const openTag = attrsStr ? `<${safeTag} ${attrsStr}>` : `<${safeTag}>`;
  const entries = Object.entries(record).filter(([k]) => k !== "@attributes" && k !== "#text");
  const textVal = record["#text"] !== undefined ? String(record["#text"] ?? "") : "";

  if (entries.length === 0 && !textVal) {
    return [attrsStr ? `${indent}<${safeTag} ${attrsStr} />` : `${indent}<${safeTag} />`];
  }
  if (entries.length === 0 && textVal) {
    return [`${indent}${openTag}${escapeXmlText(textVal)}</${safeTag}>`];
  }

  const lines: string[] = [`${indent}${openTag}`];
  if (textVal) {
    lines.push(`${indentUnit.repeat(depth + 1)}${escapeXmlText(textVal)}`);
  }
  for (const [k, v] of entries) {
    lines.push(...jsValueToXmlLines(k, v, depth + 1, indentUnit));
  }
  lines.push(`${indent}</${safeTag}>`);
  return lines;
}

export function jsonToXmlString(
  jsonText: string,
  rootTag = "root",
  indentUnit = "  "
): string {
  const trimmed = jsonText.trim();
  if (!trimmed) {
    throw new Error("Enter or upload JSON content to convert to XML.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(
      err instanceof Error ? `Invalid JSON: ${err.message}` : "Invalid JSON input."
    );
  }

  const safeRoot = sanitizeXmlTagName(rootTag, "root");
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    Object.keys(parsed as Record<string, unknown>).length === 1
  ) {
    const [onlyKey, onlyVal] = Object.entries(parsed as Record<string, unknown>)[0];
    return `<?xml version="1.0" encoding="UTF-8"?>\n${jsValueToXmlLines(
      onlyKey,
      onlyVal,
      0,
      indentUnit
    ).join("\n")}`;
  }

  if (Array.isArray(parsed)) {
    const childLines = parsed.flatMap((row) =>
      jsValueToXmlLines("record", row, 1, indentUnit)
    );
    return `<?xml version="1.0" encoding="UTF-8"?>\n<${safeRoot}>\n${childLines.join(
      "\n"
    )}\n</${safeRoot}>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${jsValueToXmlLines(
    safeRoot,
    parsed,
    0,
    indentUnit
  ).join("\n")}`;
}

function parseCsvMatrix(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"' && csvText[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      if (row.some((c) => c.trim().length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim().length > 0)) rows.push(row);
  return rows;
}

export function csvToXmlString(
  csvText: string,
  rootTag = "dataset",
  rowTag = "record",
  indentUnit = "  "
): string {
  const trimmed = csvText.trim();
  if (!trimmed) {
    throw new Error("Enter or upload CSV content to convert to XML.");
  }
  const matrix = parseCsvMatrix(trimmed);
  if (matrix.length < 2) {
    throw new Error("CSV needs at least a header row and one data row.");
  }
  const safeRoot = sanitizeXmlTagName(rootTag, "dataset");
  const safeRow = sanitizeXmlTagName(rowTag, "record");
  const headers = matrix[0].map((h, i) => sanitizeXmlTagName(h || `col_${i + 1}`, `col_${i + 1}`));

  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', `<${safeRoot}>`];
  for (let r = 1; r < matrix.length; r += 1) {
    const cells = matrix[r];
    lines.push(`${indentUnit}<${safeRow}>`);
    for (let c = 0; c < headers.length; c += 1) {
      const val = (cells[c] ?? "").trim();
      lines.push(
        `${indentUnit}${indentUnit}<${headers[c]}>${escapeXmlText(val)}</${headers[c]}>`
      );
    }
    lines.push(`${indentUnit}</${safeRow}>`);
  }
  lines.push(`</${safeRoot}>`);
  return lines.join("\n");
}
