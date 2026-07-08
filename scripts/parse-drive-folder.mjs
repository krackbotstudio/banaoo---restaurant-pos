import fs from "fs";

const html = fs.readFileSync(".tmp-drive-folder.html", "utf8");

// File rows: title in data-tooltip or aria-label, id in ssk='...:FILE_ID-0-1'
const titleMatches = [...html.matchAll(/data-tooltip="([^"]+\.mp4)"/gi)];
const idMatches = [...html.matchAll(/ssk='[^']*:([a-zA-Z0-9_-]{20,50})-0-1'/g)];

const ids = [...new Set(idMatches.map((m) => m[1]))];

// Also try extracting from JSON blob
const jsonMatch = html.match(/window\['_DRIVE_ivd'\]\s*=\s*'([^']+)'/);
if (jsonMatch) {
  try {
    const decoded = JSON.parse(jsonMatch[1].replace(/\\x([0-9A-Fa-f]{2})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    ));
    console.log("ivd keys", Object.keys(decoded).slice(0, 5));
  } catch {
    /* ignore */
  }
}

// Pair titles near file ids - grep lines with mp4
const rows = [];
const parts = html.split(".mp4");
for (let i = 0; i < parts.length - 1; i++) {
  const chunk = parts[i].slice(-200) + ".mp4";
  const titleMatch = chunk.match(/>([^<]{10,120}\.mp4)$/);
  const idMatch = (parts[i + 1].slice(0, 500) + parts[i].slice(-300)).match(
    /ssk='[^']*:([a-zA-Z0-9_-]{20,50})-0-1'/
  );
  if (titleMatch) {
    rows.push({ title: titleMatch[1].trim(), id: idMatch?.[1] ?? null });
  }
}

console.log("unique ids from ssk:", ids.length);
ids.forEach((id) => console.log(id));

console.log("\nrows from mp4 split:", rows.length);
rows.forEach((r) => console.log(r.id, r.title));
