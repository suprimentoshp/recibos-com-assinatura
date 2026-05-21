import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const dataDir = path.join(__dirname, "..", "data");
export const dbPath = path.join(dataDir, "recibos.json");

fs.mkdirSync(dataDir, { recursive: true });

const emptyData = {
  nextPersonId: 1,
  nextSectorId: 1,
  nextContractorId: 1,
  nextReceiptId: 1,
  people: [],
  sectors: [],
  contractors: [],
  receipts: [],
  signatures: []
};

function loadData() {
  if (!fs.existsSync(dbPath)) return structuredClone(emptyData);
  return { ...structuredClone(emptyData), ...JSON.parse(fs.readFileSync(dbPath, "utf8")) };
}

function saveData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

let data = loadData();

export const db = {
  backup: async (backupPath) => {
    saveData(data);
    await fs.promises.copyFile(dbPath, backupPath);
  }
};

function normalizeName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function tableItems(table) {
  if (!["people", "sectors", "contractors"].includes(table)) throw new Error("Tabela inválida");
  return data[table];
}

function nextKey(table) {
  return {
    people: "nextPersonId",
    sectors: "nextSectorId",
    contractors: "nextContractorId"
  }[table];
}

export function listSimple(table) {
  return [...tableItems(table)].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function findOrCreate(table, name) {
  const clean = normalizeName(name);
  if (!clean) throw new Error("Nome obrigatório");
  const items = tableItems(table);
  const existing = items.find((item) => item.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing.id;
  const key = nextKey(table);
  const item = { id: data[key]++, name: clean, createdAt: new Date().toISOString() };
  items.push(item);
  saveData(data);
  return item.id;
}

export function nextReceiptNumber() {
  const last = data.receipts.at(-1);
  const lastNumber = last ? Number(last.receiptNumber) : 0;
  return String(lastNumber + 1).padStart(6, "0");
}

function byId(items, id) {
  return items.find((item) => Number(item.id) === Number(id));
}

function mapReceipt(receipt) {
  if (!receipt) return null;
  const signature = data.signatures.find((item) => Number(item.receiptId) === Number(receipt.id));
  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    personName: byId(data.people, receipt.personId)?.name || "",
    sectorName: byId(data.sectors, receipt.sectorId)?.name || "",
    contractorName: byId(data.contractors, receipt.contractorId)?.name || "",
    workDate: receipt.workDate,
    paymentReason: receipt.paymentReason,
    amountCents: receipt.amountCents,
    morningDays: receipt.morningDays,
    afternoonDays: receipt.afternoonDays,
    printedAt: receipt.printedAt,
    createdAt: receipt.createdAt,
    signature: signature ? {
      imageData: signature.imageData,
      acceptanceText: signature.acceptanceText,
      signedAt: signature.signedAt,
      type: signature.signatureType
    } : null
  };
}

export function listReceipts() {
  return [...data.receipts].reverse().map(mapReceipt);
}

export function getReceipt(id) {
  return mapReceipt(byId(data.receipts, id));
}

export function createReceipt(input) {
  const personId = findOrCreate("people", input.personName);
  const sectorId = findOrCreate("sectors", input.sectorName);
  const contractorId = findOrCreate("contractors", input.contractorName);
  const amountCents = Math.round(Number(input.amount) * 100);
  if (!Number.isFinite(amountCents) || amountCents < 0) throw new Error("Valor inválido");

  const receipt = {
    id: data.nextReceiptId++,
    receiptNumber: nextReceiptNumber(),
    personId,
    sectorId,
    contractorId,
    workDate: input.workDate,
    paymentReason: String(input.paymentReason || "").trim(),
    amountCents,
    morningDays: Number(input.morningDays || 0),
    afternoonDays: Number(input.afternoonDays || 0),
    printedAt: "",
    createdAt: new Date().toISOString()
  };
  data.receipts.push(receipt);
  saveData(data);
  return mapReceipt(receipt);
}

export function markPrinted(id) {
  const receipt = byId(data.receipts, id);
  if (!receipt) return null;
  receipt.printedAt = new Date().toISOString();
  saveData(data);
  return mapReceipt(receipt);
}

export function saveSignature(id, input) {
  const receipt = byId(data.receipts, id);
  if (!receipt) return null;
  const existing = data.signatures.find((item) => Number(item.receiptId) === Number(id));
  const signature = {
    receiptId: Number(id),
    imageData: input.imageData,
    acceptanceText: input.acceptanceText,
    signedAt: new Date().toISOString(),
    signatureType: "simple_screen_signature"
  };
  if (existing) Object.assign(existing, signature);
  else data.signatures.push({ id: data.signatures.length + 1, ...signature });
  saveData(data);
  return mapReceipt(receipt);
}
