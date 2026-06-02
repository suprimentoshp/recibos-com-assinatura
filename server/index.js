import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { fileURLToPath } from "node:url";
import {
  createReceipt,
  dataDir,
  db,
  dbPath,
  findOrCreate,
  getReceipt,
  listReceipts,
  listSimple,
  markPrinted,
  saveSignature
} from "./db.js";
import { renderReceiptPdf } from "./pdf.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3333);

app.use(cors());
app.use(express.json({ limit: "8mb" }));
app.use((_req, res, next) => {
  res.charset = "utf-8";
  next();
});

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/app-data", (_req, res) => {
  if (!fs.existsSync(dbPath)) return res.json(null);
  res.json(JSON.parse(fs.readFileSync(dbPath, "utf8")));
});

function mergeBy(items, incomingItems, key) {
  const merged = new Map((items || []).map((item) => [item[key], item]));
  for (const item of incomingItems || []) {
    merged.set(item[key], { ...merged.get(item[key]), ...item });
  }
  return [...merged.values()];
}

function mergeAppData(current, incoming) {
  return {
    ...current,
    ...incoming,
    nextNumber: Math.max(Number(current.nextNumber || 0), Number(incoming.nextNumber || 0)),
    receipts: mergeBy(current.receipts, incoming.receipts, "id"),
    people: mergeBy(current.people, incoming.people, "name"),
    sectors: mergeBy(current.sectors, incoming.sectors, "name"),
    contractors: mergeBy(current.contractors, incoming.contractors, "name"),
    users: mergeBy(current.users, incoming.users, "login")
  };
}

app.put("/api/app-data", (req, res) => {
  fs.mkdirSync(dataDir, { recursive: true });
  const current = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, "utf8")) : {};
  const merged = mergeAppData(current, req.body || {});
  fs.writeFileSync(dbPath, JSON.stringify(merged, null, 2));
  res.json({ ok: true, nextNumber: merged.nextNumber });
});

app.get("/api/people", (_req, res) => res.json(listSimple("people")));
app.get("/api/sectors", (_req, res) => res.json(listSimple("sectors")));
app.get("/api/contractors", (_req, res) => res.json(listSimple("contractors")));

for (const [route, table] of [
  ["/api/people", "people"],
  ["/api/sectors", "sectors"],
  ["/api/contractors", "contractors"]
]) {
  app.post(route, (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Nome obrigatório" });
    const id = findOrCreate(table, name);
    res.status(201).json({ id, name });
  });
}

app.get("/api/receipts", (_req, res) => res.json(listReceipts()));

app.get("/api/receipts/:id", (req, res) => {
  const receipt = getReceipt(req.params.id);
  if (!receipt) return res.status(404).json({ error: "Recibo não encontrado" });
  res.json(receipt);
});

app.post("/api/receipts", (req, res) => {
  for (const field of ["personName", "workDate", "paymentReason", "sectorName", "contractorName"]) {
    if (!String(req.body[field] || "").trim()) {
      return res.status(400).json({ error: `Campo obrigatório: ${field}` });
    }
  }
  res.status(201).json(createReceipt(req.body));
});

app.post("/api/receipts/:id/printed", (req, res) => {
  const receipt = markPrinted(req.params.id);
  if (!receipt) return res.status(404).json({ error: "Recibo não encontrado" });
  res.json(receipt);
});

app.post("/api/receipts/:id/signature", (req, res) => {
  if (!String(req.body.imageData || "").startsWith("data:image/png;base64,")) {
    return res.status(400).json({ error: "Assinatura inválida" });
  }
  if (!String(req.body.acceptanceText || "").trim()) {
    return res.status(400).json({ error: "Texto de aceite obrigatório" });
  }
  const receipt = saveSignature(req.params.id, req.body);
  if (!receipt) return res.status(404).json({ error: "Recibo não encontrado" });
  res.json(receipt);
});

app.get("/api/receipts/:id/signature-qr", asyncRoute(async (req, res) => {
  const receipt = getReceipt(req.params.id);
  if (!receipt) return res.status(404).json({ error: "Recibo não encontrado" });
  const origin = req.get("origin") || `http://${req.hostname}:5173`;
  const url = `${origin}/?sign=${receipt.id}`;
  const png = await QRCode.toBuffer(url, { type: "png", margin: 1, width: 220 });
  res.type("png").send(png);
}));

app.get("/api/receipts/:id/pdf", (req, res) => {
  const receipt = getReceipt(req.params.id);
  if (!receipt) return res.status(404).json({ error: "Recibo não encontrado" });
  markPrinted(req.params.id);
  const freshReceipt = getReceipt(req.params.id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="recibo-${freshReceipt.receiptNumber}.pdf"`);
  renderReceiptPdf(freshReceipt, res);
});

app.get("/api/backup", (_req, res) => {
  if (!fs.existsSync(dbPath)) return res.status(404).json({ error: "Banco ainda não criado" });
  const fileName = `backup-recibos-${new Date().toISOString().slice(0, 10)}.json`;
  const backupPath = path.join(dataDir, fileName);
  db.backup(backupPath)
    .then(() => res.download(backupPath, fileName))
    .catch((err) => res.status(500).json({ error: err.message || "Erro ao gerar backup" }));
});

const distDir = path.join(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.get("/sw.js", (_req, res) => {
    res.type("application/javascript");
    res.setHeader("Cache-Control", "no-store");
    res.send(`
      self.addEventListener('install', event => self.skipWaiting());
      self.addEventListener('activate', event => {
        event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))).then(() => self.registration.unregister()));
      });
      self.addEventListener('fetch', event => event.respondWith(fetch(event.request)));
    `);
  });
  app.get(["/", "/app-sem-npm.html"], (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(path.join(__dirname, "..", "app-sem-npm.html"));
  });
  app.use(express.static(distDir));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Erro interno" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`API de recibos em http://localhost:${port}`);
});
