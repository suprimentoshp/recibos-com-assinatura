import cors from "cors";
import express from "express";
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { fileURLToPath } from "node:url";
import {
  createReceipt,
  dataDir,
  dbPath,
  findOrCreate,
  getReceipt,
  listReceipts,
  listSimple,
  markPrinted,
  saveSignature
} from "./db.js";
import { renderReceiptPdf } from "./pdf.js";

const isLocalExe = path.basename(process.execPath).toLowerCase() === "recibos-planalto.exe";
const moduleDir = isLocalExe ? path.dirname(process.execPath) : path.dirname(fileURLToPath(import.meta.url));
const appRoot = process.pkg || isLocalExe ? path.dirname(process.execPath) : path.join(moduleDir, "..");
const app = express();
const port = Number(process.env.PORT || 3333);
const firstReceiptNumber = 100400;
const allowedSectors = ["Recepção", "Copa", "Lumen", "Governança", "Manutenção"];
const allowedContractors = ["Walnisa", "Fernando", "João", "Ana Paula", "Jean", "Felipe", "Marcio", "Daniel"];

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
  res.json({ ok: true, dataDir, dbPath, databaseExists: fs.existsSync(dbPath) });
});

app.get("/api/app-data", (_req, res) => {
  if (!fs.existsSync(dbPath)) return res.json(null);
  const stored = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  const repaired = sanitizeAppData(stored);
  persistAppData(repaired);
  res.json(repaired);
});

const backupsDir = path.join(dataDir, "backups");

function backupName(prefix = "recibos") {
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  return `${prefix}-${stamp}.json`;
}

function rotateBackups(limit = 120) {
  if (!fs.existsSync(backupsDir)) return;
  const backups = fs.readdirSync(backupsDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort()
    .reverse();
  backups.slice(limit).forEach((fileName) => fs.unlinkSync(path.join(backupsDir, fileName)));
}

function writeBackup(fileName, content) {
  fs.mkdirSync(backupsDir, { recursive: true });
  fs.writeFileSync(path.join(backupsDir, fileName), content);
  rotateBackups();
}

function ensureDailyBackup(currentContent) {
  if (!currentContent) return;
  const today = new Date().toISOString().slice(0, 10);
  const dailyName = `backup-diario-${today}.json`;
  const dailyPath = path.join(backupsDir, dailyName);
  if (!fs.existsSync(dailyPath)) writeBackup(dailyName, currentContent);
}

function persistAppData(data) {
  fs.mkdirSync(dataDir, { recursive: true });
  const nextContent = JSON.stringify(data, null, 2);
  const currentContent = fs.existsSync(dbPath) ? fs.readFileSync(dbPath, "utf8") : "";
  if (currentContent === nextContent) return;
  if (currentContent) {
    writeBackup(backupName("recibos-antes-da-gravacao"), currentContent);
    ensureDailyBackup(currentContent);
  }
  const temporaryPath = `${dbPath}.tmp`;
  fs.writeFileSync(temporaryPath, nextContent);
  fs.renameSync(temporaryPath, dbPath);
}

function mergeBy(items, incomingItems, key) {
  const merged = new Map((items || []).map((item) => [item[key], item]));
  for (const item of incomingItems || []) {
    merged.set(item[key], { ...merged.get(item[key]), ...item });
  }
  return [...merged.values()];
}

function receiptNumberValue(receipt) {
  return Number(String(receipt?.receiptNumber || "").replace(/\D/g, "")) || 0;
}

function formatReceiptNumber(value) {
  return String(value).padStart(6, "0");
}

function receiptDateValue(receipt) {
  return new Date(receipt?.issuedAt || receipt?.createdAt || 0).getTime() || 0;
}

function ensureUniqueReceiptNumbers(receipts, nextNumberCandidate) {
  const ordered = [...(receipts || [])].sort((a, b) => {
    return receiptNumberValue(a) - receiptNumberValue(b)
      || receiptDateValue(a) - receiptDateValue(b);
  });
  const highestNumber = Math.max(firstReceiptNumber - 1, ...ordered.map(receiptNumberValue));
  let nextNumber = Math.max(Number(nextNumberCandidate || 0), highestNumber + 1, firstReceiptNumber);
  const used = new Set();
  for (const receipt of ordered) {
    const currentNumber = receiptNumberValue(receipt);
    if (currentNumber >= firstReceiptNumber && !used.has(currentNumber)) {
      used.add(currentNumber);
      receipt.receiptNumber = formatReceiptNumber(currentNumber);
      continue;
    }
    while (used.has(nextNumber)) nextNumber += 1;
    receipt.receiptNumber = formatReceiptNumber(nextNumber);
    used.add(nextNumber);
    nextNumber += 1;
  }
  const maxUsed = Math.max(firstReceiptNumber - 1, ...[...used]);
  return { receipts, nextNumber: Math.max(nextNumber, maxUsed + 1) };
}

function legacyText(item) {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object") return "";
  if (typeof item.name === "string") return item.name.trim();
  return Object.keys(item)
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => item[key])
    .join("")
    .trim();
}

function mergeTextLists(items, incomingItems = []) {
  const merged = new Map();
  for (const item of [...(items || []), ...(incomingItems || [])]) {
    const text = legacyText(item);
    if (text) merged.set(text.toLocaleLowerCase("pt-BR"), text);
  }
  return [...merged.values()];
}

function sanitizeAppData(data) {
  if (!data || typeof data !== "object") return data;
  return {
    ...data,
    people: mergeTextLists(data.people),
    sectors: [...allowedSectors],
    contractors: [...allowedContractors]
  };
}

function mergeAppData(current, incoming) {
  current = current && typeof current === "object" ? current : {};
  incoming = incoming && typeof incoming === "object" ? incoming : {};
  const numbered = ensureUniqueReceiptNumbers(
    mergeBy(current.receipts, incoming.receipts, "id"),
    Math.max(Number(current.nextNumber || 0), Number(incoming.nextNumber || 0))
  );
  return sanitizeAppData({
    ...current,
    ...incoming,
    nextNumber: numbered.nextNumber,
    receipts: numbered.receipts,
    people: mergeTextLists(current.people, incoming.people),
    sectors: mergeTextLists(current.sectors, incoming.sectors),
    contractors: mergeTextLists(current.contractors, incoming.contractors),
    users: mergeBy(current.users, incoming.users, "login")
  });
}

app.put("/api/app-data", (req, res) => {
  const current = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, "utf8")) : {};
  const merged = mergeAppData(current, req.body || {});
  persistAppData(merged);
  res.json({ ok: true, nextNumber: merged.nextNumber, data: merged });
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
  const fileName = backupName("backup-manual-recibos");
  const backupPath = path.join(dataDir, fileName);
  fs.copyFileSync(dbPath, backupPath);
  res.download(backupPath, fileName);
});

const distDir = path.join(appRoot, "dist");
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
    res.sendFile(path.join(appRoot, "app-sem-npm.html"));
  });
  app.use(express.static(distDir));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Erro interno" });
});

function openLocalBrowser(url) {
  if (!isLocalExe || process.env.RECIBOS_NO_BROWSER === "1") return;
  const command = process.platform === "win32"
    ? `start "" "${url}"`
    : process.platform === "darwin"
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(command, () => {});
}

const server = app.listen(port, "0.0.0.0", () => {
  const localUrl = `http://localhost:${port}`;
  console.log(`Recibos Planalto iniciado em ${localUrl}`);
  console.log(`Banco de dados: ${dbPath}`);
  openLocalBrowser(localUrl);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`A porta ${port} ja esta em uso. Feche outra copia do app ou reinicie o computador.`);
  } else {
    console.error("Nao foi possivel iniciar o servidor local:", error);
  }
  if (isLocalExe) {
    console.error("Esta janela ficara aberta para voce conseguir ler o erro.");
    setInterval(() => {}, 60_000);
  }
});
