import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";

const firebaseConfig = {
  apiKey: "AIzaSyC_-oQ0MY2anXHrD_Bm-4-exLmHRZb4Apk",
  authDomain: "letsgetdirty.firebaseapp.com",
  projectId: "letsgetdirty",
  storageBucket: "letsgetdirty.firebasestorage.app",
  messagingSenderId: "877273017008",
  appId: "1:877273017008:web:e2e643c331701fd33de975",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTIONS = ["profiles", "invoices", "offers", "campaigns", "merchants", "otherFolders", "spotlightSponsors", "surveyResponses"];
const OUT_DIR = path.join(process.env.HOME, "Downloads", "Avyaya-Database-Export");

function csvEscape(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") val = JSON.stringify(val);
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  if (rows.length === 0) return "id\n";
  const keys = new Set(["id"]);
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
  const header = Array.from(keys);
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(header.map((k) => csvEscape(r[k])).join(","));
  }
  return lines.join("\n");
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const summary = [];
  for (const name of COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, name));
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const csv = toCsv(rows);
      const outPath = path.join(OUT_DIR, `${name}.csv`);
      fs.writeFileSync(outPath, csv);
      console.log(`${name}: ${rows.length} docs -> ${outPath}`);
      summary.push({ name, count: rows.length });
    } catch (err) {
      console.error(`${name}: ERROR - ${err.message}`);
      summary.push({ name, count: "ERROR: " + err.message });
    }
  }
  console.log("\n=== SUMMARY ===");
  summary.forEach((s) => console.log(`${s.name}: ${s.count}`));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
