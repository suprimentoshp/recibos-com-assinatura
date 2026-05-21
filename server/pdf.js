import PDFDocument from "pdfkit";

function money(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function date(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function dateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function addRow(doc, label, value, x, y, width) {
  doc.fontSize(8).fillColor("#66737c").text(label.toUpperCase(), x, y, { width });
  doc.fontSize(11).fillColor("#17232b").text(String(value || ""), x, y + 14, { width });
}

export function renderReceiptPdf(receipt, stream) {
  const doc = new PDFDocument({ size: "A4", margin: 52 });
  doc.pipe(stream);

  doc.fontSize(10).fillColor("#c8872d").text("RECIBO DE PAGAMENTO", 52, 48);
  doc.fontSize(25).fillColor("#17232b").text(`Recibo Nº ${receipt.receiptNumber}`, 52, 68);
  doc.fontSize(21).fillColor("#174a63").text(money(receipt.amountCents), 390, 74, { width: 150, align: "right" });
  doc.moveTo(52, 118).lineTo(543, 118).strokeColor("#17232b").lineWidth(1.4).stroke();

  doc.fontSize(12).fillColor("#17232b").text(
    "Recebi de acordo com as informações abaixo o valor referente a serviço prestado.",
    52,
    148,
    { width: 490, lineGap: 4 }
  );

  const left = 52;
  const right = 306;
  const width = 220;
  let y = 215;
  addRow(doc, "Nome", receipt.personName, left, y, width);
  addRow(doc, "Data trabalhada", date(receipt.workDate), right, y, width);
  y += 58;
  addRow(doc, "Motivo do pagamento", receipt.paymentReason, left, y, width);
  addRow(doc, "Setor", receipt.sectorName, right, y, width);
  y += 58;
  addRow(doc, "Responsável pela contratação", receipt.contractorName, left, y, width);
  addRow(doc, "Períodos trabalhados", `${receipt.morningDays} manhã(s) e ${receipt.afternoonDays} tarde(s)`, right, y, width);
  y += 58;
  addRow(doc, "Data de impressão", receipt.printedAt ? dateTime(receipt.printedAt) : "Ainda não impresso", left, y, width);
  addRow(doc, "Status da assinatura", receipt.signature ? "Assinado eletronicamente" : "Pendente", right, y, width);

  doc.moveTo(150, 610).lineTo(445, 610).strokeColor("#d9e1e5").lineWidth(1).stroke();
  if (receipt.signature) {
    const base64 = receipt.signature.imageData.replace(/^data:image\/png;base64,/, "");
    doc.image(Buffer.from(base64, "base64"), 178, 520, { fit: [240, 80] });
    doc.fontSize(8).fillColor("#66737c").text(receipt.signature.acceptanceText, 104, 624, { width: 386, align: "center" });
    doc.text(`Assinado em ${dateTime(receipt.signature.signedAt)}`, 104, 650, { width: 386, align: "center" });
  } else {
    doc.fontSize(10).fillColor("#66737c").text("Assinatura pendente", 104, 624, { width: 386, align: "center" });
  }

  doc.fontSize(8).fillColor("#66737c").text(
    "Assinatura eletrônica simples coletada em tela. Para maior força jurídica, utilize integração GOV.BR ou certificado ICP-Brasil.",
    52,
    748,
    { width: 490, align: "center" }
  );

  doc.end();
}
