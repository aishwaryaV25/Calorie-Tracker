import PDFDocument from 'pdfkit';

export const THEME = {
  ink: '#111113',
  muted: '#3e3e3e',
  subtle: '#8a8a8f',
  accent: '#ff223f',
  accentSoft: '#ffe8ec',
  panel: '#f2f2f4',
  border: '#e4e4e8',
  white: '#ffffff',
} as const;

const PAGE_MARGIN = 44;
const CORNER_RADIUS = 6;

export type Document = PDFKit.PDFDocument;

export function createDocument(title: string): Document {
  return new PDFDocument({
    size: 'A4',
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN + 14, left: PAGE_MARGIN, right: PAGE_MARGIN },

    bufferPages: true,
    info: { Title: title, Author: 'Calorie, by Typeface' },
  });
}

export const contentWidth = (doc: Document): number =>
  doc.page.width - doc.page.margins.left - doc.page.margins.right;

const bottomLimit = (doc: Document): number => doc.page.height - doc.page.margins.bottom;

export function ensureSpace(doc: Document, needed: number): void {
  if (doc.y + needed > bottomLimit(doc)) {
    doc.addPage();
  }
}

export function banner(doc: Document, title: string, subtitle: string, meta: string): void {
  const height = 96;
  const { left } = doc.page.margins;

  doc.rect(0, 0, doc.page.width, height).fill(THEME.ink);
  doc.rect(0, height - 3, doc.page.width, 3).fill(THEME.accent);

  doc.roundedRect(left, 28, 16, 16, 3).fill(THEME.accent);
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(THEME.white)
    .text('BY TYPEFACE', left + 24, 32, { characterSpacing: 1.4 });

  doc.font('Helvetica-Bold').fontSize(20).fillColor(THEME.white).text(title, left, 54);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(THEME.border)
    .text(meta, left, 62, { width: contentWidth(doc), align: 'right' });

  doc.y = height + 18;
  doc.font('Helvetica').fontSize(10).fillColor(THEME.muted).text(subtitle, left, doc.y);
  doc.y += 12;
}

export function sectionTitle(doc: Document, text: string): void {
  ensureSpace(doc, 90);

  const { left } = doc.page.margins;
  const top = doc.y;

  doc.rect(left, top, 22, 2).fill(THEME.accent);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(THEME.ink).text(text, left, top + 10);
  doc.y += 6;
}

export function paragraph(doc: Document, text: string): void {
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(THEME.subtle)
    .text(text, doc.page.margins.left, doc.y, { width: contentWidth(doc) });
  doc.y += 8;
}

export interface Tile {
  label: string;
  value: string;
  note?: string;

  isAlert?: boolean;
}

export function tiles(doc: Document, items: Tile[]): void {
  const height = 62;
  ensureSpace(doc, height + 12);

  const { left } = doc.page.margins;
  const gap = 10;
  const width = (contentWidth(doc) - gap * (items.length - 1)) / items.length;
  const top = doc.y;

  items.forEach((tile, index) => {
    const x = left + index * (width + gap);

    doc
      .roundedRect(x, top, width, height, CORNER_RADIUS)
      .fillAndStroke(THEME.panel, THEME.border);

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(THEME.subtle)
      .text(tile.label.toUpperCase(), x + 10, top + 10, {
        width: width - 20,
        characterSpacing: 0.6,
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor(tile.isAlert ? THEME.accent : THEME.ink)
      .text(tile.value, x + 10, top + 24, { width: width - 20, lineBreak: false });

    if (tile.note) {
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(THEME.subtle)
        .text(tile.note, x + 10, top + 45, { width: width - 20, lineBreak: false });
    }
  });

  doc.y = top + height + 14;
}

export interface Column {
  header: string;

  width: number;
  align?: 'left' | 'right';
}

const ROW_HEIGHT = 18;
const HEADER_HEIGHT = 20;

export function table(doc: Document, columns: Column[], rows: string[][]): void {
  ensureSpace(doc, HEADER_HEIGHT + ROW_HEIGHT * 2);

  const { left } = doc.page.margins;
  const total = contentWidth(doc);
  const widths = columns.map((column) => column.width * total);
  const offsets = widths.map((_, index) => left + widths.slice(0, index).reduce((a, b) => a + b, 0));

  const drawHeader = () => {
    const top = doc.y;
    doc.rect(left, top, total, HEADER_HEIGHT).fill(THEME.ink);

    columns.forEach((column, index) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(THEME.white)
        .text(column.header.toUpperCase(), offsets[index]! + 6, top + 6.5, {
          width: widths[index]! - 12,
          align: column.align ?? 'left',
          lineBreak: false,
          characterSpacing: 0.5,
        });
    });

    doc.y = top + HEADER_HEIGHT;
  };

  drawHeader();

  rows.forEach((row, rowIndex) => {
    if (doc.y + ROW_HEIGHT > bottomLimit(doc)) {
      doc.addPage();
      drawHeader();
    }

    const top = doc.y;

    if (rowIndex % 2 === 1) {
      doc.rect(left, top, total, ROW_HEIGHT).fill(THEME.panel);
    }

    columns.forEach((column, index) => {
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(index === 0 ? THEME.ink : THEME.muted)
        .text(row[index] ?? '', offsets[index]! + 6, top + 5, {
          width: widths[index]! - 12,
          align: column.align ?? 'left',
          lineBreak: false,
        });
    });

    doc.y = top + ROW_HEIGHT;
  });

  doc
    .moveTo(left, doc.y)
    .lineTo(left + total, doc.y)
    .strokeColor(THEME.border)
    .lineWidth(0.5)
    .stroke();

  doc.y += 14;
}

export interface Bar {
  label: string;
  value: number;

  isOver?: boolean;
}

export function barChart(doc: Document, bars: Bar[], target: number | null): void {
  const height = 130;
  ensureSpace(doc, height + 24);

  const { left } = doc.page.margins;
  const width = contentWidth(doc);
  const top = doc.y;
  const plotHeight = height - 22;
  const baseline = top + plotHeight;

  const peak = Math.max(...bars.map((bar) => bar.value), target ?? 0, 1);
  const scale = plotHeight / (peak * 1.1);

  doc.roundedRect(left, top - 6, width, height, CORNER_RADIUS).fillAndStroke(THEME.white, THEME.border);

  const inset = 10;
  const slot = (width - inset * 2) / bars.length;
  const barWidth = Math.min(slot * 0.62, 22);
  const plotLeft = left + inset;

  bars.forEach((bar, index) => {
    const barHeight = bar.value * scale;
    const x = plotLeft + index * slot + (slot - barWidth) / 2;

    if (barHeight > 0) {
      doc
        .rect(x, baseline - barHeight, barWidth, barHeight)
        .fill(bar.isOver ? THEME.accent : THEME.ink);
    }

    const step = Math.ceil(bars.length / 10);

    if (index % step === 0) {
      doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor(THEME.subtle)
        .text(bar.label, plotLeft + index * slot, baseline + 6, {
          width: slot * step,
          align: 'center',
          lineBreak: false,
        });
    }
  });

  if (target && target > 0) {
    const y = baseline - target * scale;

    doc
      .moveTo(left + 2, y)
      .lineTo(left + width - 2, y)
      .dash(3, { space: 2 })
      .strokeColor(THEME.accent)
      .lineWidth(0.8)
      .stroke()
      .undash();

    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(THEME.accent)

      .text(`target ${Math.round(target)}`, left + 6, y - 9, { lineBreak: false });
  }

  doc.y = top + height + 8;
}

export interface MeterRow {
  label: string;
  value: string;

  fraction: number;
}

export function meters(doc: Document, rows: MeterRow[]): void {
  ensureSpace(doc, rows.length * 22 + 10);

  const { left } = doc.page.margins;
  const width = contentWidth(doc);
  const labelWidth = 92;
  const valueWidth = 104;
  const trackWidth = width - labelWidth - valueWidth - 16;

  rows.forEach((row) => {
    const top = doc.y;

    doc.font('Helvetica').fontSize(8.5).fillColor(THEME.ink).text(row.label, left, top + 1, {
      width: labelWidth,
      lineBreak: false,
    });

    const trackX = left + labelWidth + 8;
    doc.roundedRect(trackX, top, trackWidth, 9, 4.5).fill(THEME.panel);

    const filled = Math.max(Math.min(row.fraction, 1), 0) * trackWidth;

    if (filled > 0) {
      doc
        .roundedRect(trackX, top, filled, 9, 4.5)
        .fill(row.fraction > 1 ? THEME.accent : THEME.ink);
    }

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(THEME.muted)
      .text(row.value, trackX + trackWidth + 8, top + 1, {
        width: valueWidth,
        align: 'right',
        lineBreak: false,
      });

    doc.y = top + 20;
  });

  doc.y += 4;
}

export function finish(doc: Document, footerNote: string): void {
  const range = doc.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);

    const y = doc.page.height - doc.page.margins.bottom + 8;

    doc.page.margins.bottom = 0;

    const width = contentWidth(doc);

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(THEME.subtle)
      .text(footerNote, doc.page.margins.left, y, { lineBreak: false })
      .text(`Page ${index - range.start + 1} of ${range.count}`, doc.page.margins.left, y, {
        width,
        align: 'right',
        lineBreak: false,
      });
  }

  doc.end();
}

export function toBuffer(doc: Document): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}
