import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Banknote,
  CalendarDays,
  Download,
  FileDown,
  FileSignature,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Trash2,
  Users
} from "lucide-react";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "";

const emptyReceipt = {
  personName: "",
  workDate: new Date().toISOString().slice(0, 10),
  paymentReason: "",
  amount: "",
  morningDays: 0,
  afternoonDays: 0,
  sectorName: "",
  contractorName: ""
};

function formatMoney(cents = 0) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro inesperado" }));
    throw new Error(error.error || "Erro inesperado");
  }
  if (response.status === 204) return null;
  return response.json();
}

function useData() {
  const [state, setState] = useState({
    receipts: [],
    people: [],
    sectors: [],
    contractors: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [receipts, people, sectors, contractors] = await Promise.all([
        api("/api/receipts"),
        api("/api/people"),
        api("/api/sectors"),
        api("/api/contractors")
      ]);
      setState({ receipts, people, sectors, contractors });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return { ...state, loading, error, refresh };
}

function Field({ label, children, wide = false }) {
  return (
    <label className={wide ? "field field-wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ReceiptPreview({ receipt }) {
  if (!receipt) {
    return (
      <section className="empty-preview">
        <FileSignature size={40} />
        <strong>Nenhum recibo selecionado</strong>
        <span>Crie ou selecione um recibo para visualizar, imprimir e assinar.</span>
      </section>
    );
  }

  return (
    <section className="receipt-paper" id="printable-receipt">
      <header>
        <div>
          <span className="eyebrow">Recibo de pagamento</span>
          <h2>Recibo Nº {receipt.receiptNumber}</h2>
        </div>
        <div className="receipt-total">{formatMoney(receipt.amountCents)}</div>
      </header>

      <p className="receipt-text">
        Recebi de acordo com as informações abaixo o valor referente a serviço prestado.
      </p>

      <dl className="receipt-grid">
        <div>
          <dt>Nome</dt>
          <dd>{receipt.personName}</dd>
        </div>
        <div>
          <dt>Data trabalhada</dt>
          <dd>{formatDate(receipt.workDate)}</dd>
        </div>
        <div>
          <dt>Motivo do pagamento</dt>
          <dd>{receipt.paymentReason}</dd>
        </div>
        <div>
          <dt>Setor</dt>
          <dd>{receipt.sectorName}</dd>
        </div>
        <div>
          <dt>Responsável pela contratação</dt>
          <dd>{receipt.contractorName}</dd>
        </div>
        <div>
          <dt>Períodos trabalhados</dt>
          <dd>{receipt.morningDays} manhã(s) e {receipt.afternoonDays} tarde(s)</dd>
        </div>
        <div>
          <dt>Data de impressão</dt>
          <dd>{receipt.printedAt ? formatDateTime(receipt.printedAt) : "Ainda não impresso"}</dd>
        </div>
        <div>
          <dt>Status da assinatura</dt>
          <dd>{receipt.signature ? "Assinado eletronicamente" : "Pendente"}</dd>
        </div>
      </dl>

      <footer className="signature-area">
        {receipt.signature ? (
          <>
            <img src={receipt.signature.imageData} alt="Assinatura eletrônica" />
            <small>{receipt.signature.acceptanceText}</small>
            <small>Assinado em {formatDateTime(receipt.signature.signedAt)}</small>
          </>
        ) : (
          <span>Assinatura pendente</span>
        )}
      </footer>
    </section>
  );
}

function SignaturePad({ receiptId, onSaved, onCancel }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  function point(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0];
    return {
      x: (touch?.clientX ?? event.clientX) - rect.left,
      y: (touch?.clientY ?? event.clientY) - rect.top
    };
  }

  function start(event) {
    event.preventDefault();
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function draw(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function stop() {
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function save() {
    setSaving(true);
    try {
      await api(`/api/receipts/${receiptId}/signature`, {
        method: "POST",
        body: JSON.stringify({
          imageData: canvasRef.current.toDataURL("image/png"),
          acceptanceText: "Declaro que recebi o valor descrito neste recibo e confirmo minha assinatura eletrônica simples."
        })
      });
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="signature-modal" role="dialog" aria-modal="true">
      <div className="signature-box">
        <header>
          <h2>Assinatura do recibo</h2>
          <button className="icon-button" onClick={onCancel} title="Fechar">×</button>
        </header>
        <canvas
          ref={canvasRef}
          className="signature-canvas"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={stop}
        />
        <label className="checkline">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>Confirmo que esta assinatura representa meu aceite do recibo.</span>
        </label>
        <div className="modal-actions">
          <button className="secondary" onClick={clear}><RotateCcw size={16} /> Limpar</button>
          <button className="primary" disabled={!accepted || saving} onClick={save}><Save size={16} /> Salvar assinatura</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const data = useData();
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyReceipt);
  const [filters, setFilters] = useState({ q: "", date: "", sector: "" });
  const [showSignature, setShowSignature] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = data.receipts.find((receipt) => receipt.id === selectedId) || data.receipts[0] || null;

  useEffect(() => {
    if (!selectedId && data.receipts[0]) setSelectedId(data.receipts[0].id);
  }, [data.receipts, selectedId]);

  const filteredReceipts = useMemo(() => {
    const query = filters.q.toLowerCase();
    return data.receipts.filter((receipt) => {
      const matchesText = !query || [receipt.personName, receipt.receiptNumber, receipt.paymentReason, receipt.contractorName]
        .some((value) => String(value || "").toLowerCase().includes(query));
      const matchesDate = !filters.date || receipt.workDate?.slice(0, 10) === filters.date;
      const matchesSector = !filters.sector || receipt.sectorName === filters.sector;
      return matchesText && matchesDate && matchesSector;
    });
  }, [data.receipts, filters]);

  async function createReceipt(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await api("/api/receipts", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          amount: Number(String(form.amount).replace(",", "."))
        })
      });
      setSelectedId(created.id);
      setForm({ ...emptyReceipt, workDate: new Date().toISOString().slice(0, 10) });
      await data.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function printReceipt() {
    if (!selected) return;
    await api(`/api/receipts/${selected.id}/printed`, { method: "POST" });
    await data.refresh();
    window.print();
  }

  const signatureUrl = selected ? `${window.location.origin}/?sign=${selected.id}` : "";
  const params = new URLSearchParams(window.location.search);
  const signId = params.get("sign");

  if (signId) {
    return (
      <main className="sign-only">
        <SignaturePad
          receiptId={signId}
          onSaved={async () => {
            window.history.replaceState({}, "", "/");
            await data.refresh();
          }}
          onCancel={() => window.history.replaceState({}, "", "/")}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <FileSignature size={28} />
          <div>
            <strong>Recibos</strong>
            <span>Pagamento com assinatura</span>
          </div>
        </div>

        <section className="toolbar">
          <label className="searchbox">
            <Search size={18} />
            <input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Buscar por nome, número ou motivo" />
          </label>
          <div className="filter-row">
            <input type="date" value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })} />
            <select value={filters.sector} onChange={(event) => setFilters({ ...filters, sector: event.target.value })}>
              <option value="">Todos os setores</option>
              {data.sectors.map((sector) => <option key={sector.id}>{sector.name}</option>)}
            </select>
          </div>
        </section>

        <section className="receipt-list">
          {data.loading && <span className="muted">Carregando...</span>}
          {data.error && <span className="error">{data.error}</span>}
          {filteredReceipts.map((receipt) => (
            <button
              key={receipt.id}
              className={receipt.id === selected?.id ? "receipt-item active" : "receipt-item"}
              onClick={() => setSelectedId(receipt.id)}
            >
              <span>#{receipt.receiptNumber}</span>
              <strong>{receipt.personName}</strong>
              <small>{formatDate(receipt.workDate)} · {formatMoney(receipt.amountCents)}</small>
            </button>
          ))}
        </section>
      </aside>

      <section className="workspace">
        <div className="topbar">
          <div>
            <span className="eyebrow">Novo recibo</span>
            <h1>Emissão rápida de recibos simples</h1>
          </div>
          <div className="top-actions">
            <a className="secondary" href={`${API}/api/backup`}><Download size={16} /> Backup</a>
            <button className="secondary" onClick={data.refresh}><RefreshCw size={16} /> Atualizar</button>
          </div>
        </div>

        <form className="receipt-form" onSubmit={createReceipt}>
          <Field label="Nome">
            <input list="people" required value={form.personName} onChange={(event) => setForm({ ...form, personName: event.target.value })} />
            <datalist id="people">{data.people.map((item) => <option key={item.id} value={item.name} />)}</datalist>
          </Field>
          <Field label="Data trabalhada">
            <input type="date" required value={form.workDate} onChange={(event) => setForm({ ...form, workDate: event.target.value })} />
          </Field>
          <Field label="Valor">
            <input type="number" min="0" step="0.01" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </Field>
          <Field label="Manhãs">
            <input type="number" min="0" required value={form.morningDays} onChange={(event) => setForm({ ...form, morningDays: event.target.value })} />
          </Field>
          <Field label="Tardes">
            <input type="number" min="0" required value={form.afternoonDays} onChange={(event) => setForm({ ...form, afternoonDays: event.target.value })} />
          </Field>
          <Field label="Setor">
            <input list="sectors" required value={form.sectorName} onChange={(event) => setForm({ ...form, sectorName: event.target.value })} />
            <datalist id="sectors">{data.sectors.map((item) => <option key={item.id} value={item.name} />)}</datalist>
          </Field>
          <Field label="Responsável">
            <input list="contractors" required value={form.contractorName} onChange={(event) => setForm({ ...form, contractorName: event.target.value })} />
            <datalist id="contractors">{data.contractors.map((item) => <option key={item.id} value={item.name} />)}</datalist>
          </Field>
          <Field label="Motivo do pagamento" wide>
            <textarea required value={form.paymentReason} onChange={(event) => setForm({ ...form, paymentReason: event.target.value })} />
          </Field>
          <button className="primary submit-button" disabled={saving}><Plus size={18} /> Criar recibo</button>
        </form>

        <div className="action-strip">
          <button className="primary" disabled={!selected} onClick={printReceipt}><Printer size={16} /> Imprimir</button>
          <a className="secondary" aria-disabled={!selected} href={selected ? `${API}/api/receipts/${selected.id}/pdf` : "#"}><FileDown size={16} /> PDF</a>
          <button className="secondary" disabled={!selected} onClick={() => setShowSignature(true)}><FileSignature size={16} /> Assinar nesta tela</button>
          <button
            className="secondary"
            disabled={!selected}
            onClick={() => navigator.clipboard?.writeText(signatureUrl)}
            title="Copia o link para abrir no celular"
          >
            <Send size={16} /> Copiar link de assinatura
          </button>
        </div>

        {selected && (
          <div className="signature-link">
            <Users size={16} />
            <span>Link para celular: {signatureUrl}</span>
            <img src={`${API}/api/receipts/${selected.id}/signature-qr`} alt="QR Code para assinatura" />
          </div>
        )}

        <ReceiptPreview receipt={selected} />
      </section>

      {showSignature && selected && (
        <SignaturePad
          receiptId={selected.id}
          onCancel={() => setShowSignature(false)}
          onSaved={async () => {
            setShowSignature(false);
            await data.refresh();
          }}
        />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
