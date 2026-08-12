import type { Transaction } from "@/types";

export interface ReportPdfMetric {
  label: string;
  value: string;
  note?: string;
}

export interface ReportPdfTable {
  title: string;
  description?: string;
  columns: string[];
  rows: string[][];
  summaryOnly?: boolean;
}

export interface ReportPdfData {
  title: string;
  dateRange: string;
  generatedAt: string;
  metadata: { label: string; value: string }[];
  metrics: ReportPdfMetric[];
  insights: string[];
  tables: ReportPdfTable[];
  chartElementIds: string[];
  transactions: Transaction[];
  accountName: (accountId?: string) => string;
}

export type ReportPdfMode = "summary" | "detailed";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 44;
const TOP_CONTENT = 82;
const BOTTOM_CONTENT = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const EMERALD: [number, number, number] = [40, 89, 67];
const NAVY: [number, number, number] = [41, 58, 94];
const MUTED: [number, number, number] = [100, 116, 109];
const BORDER: [number, number, number] = [214, 224, 219];
const MINT: [number, number, number] = [240, 249, 245];

function safeFilename(value: string) {
  return (
    value
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ledgerly-report"
  );
}

function currencyAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(value));
}

async function createReportPdf(
  data: ReportPdfData,
  mode: ReportPdfMode,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
    compress: true,
  });
  let y = TOP_CONTENT;

  const drawPageHeader = () => {
    pdf.setFillColor(...EMERALD);
    pdf.rect(0, 0, PAGE_WIDTH, 54, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.text("Ledgerly Pro", MARGIN_X, 33);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(mode === "summary" ? "SUMMARY REPORT" : "DETAILED REPORT", PAGE_WIDTH - MARGIN_X, 32, {
      align: "right",
    });
    pdf.setTextColor(...NAVY);
  };

  const drawPageFooter = (pageNumber: number, totalPages: number) => {
    pdf.setDrawColor(...BORDER);
    pdf.line(MARGIN_X, PAGE_HEIGHT - 36, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 36);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text("Ledgerly Pro - Clarity today. Freedom tomorrow.", MARGIN_X, PAGE_HEIGHT - 21);
    pdf.text(`Page ${pageNumber} of ${totalPages}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 21, {
      align: "right",
    });
  };

  const addPage = () => {
    pdf.addPage();
    drawPageHeader();
    y = TOP_CONTENT;
  };

  const ensureSpace = (height: number) => {
    if (y + height > PAGE_HEIGHT - BOTTOM_CONTENT) addPage();
  };

  const sectionHeading = (title: string, description?: string) => {
    ensureSpace(description ? 48 : 30);
    pdf.setTextColor(...NAVY);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(title, MARGIN_X, y);
    y += 8;
    pdf.setDrawColor(...EMERALD);
    pdf.setLineWidth(1.5);
    pdf.line(MARGIN_X, y, MARGIN_X + 42, y);
    y += 13;
    if (description) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...MUTED);
      const lines = pdf.splitTextToSize(description, CONTENT_WIDTH);
      pdf.text(lines, MARGIN_X, y);
      y += lines.length * 10 + 6;
    }
  };

  const drawTable = (table: ReportPdfTable) => {
    if (table.rows.length === 0) return;
    sectionHeading(table.title, table.description);
    const columnCount = table.columns.length;
    const columnWidth = CONTENT_WIDTH / columnCount;
    const drawHeader = () => {
      ensureSpace(24);
      pdf.setFillColor(...EMERALD);
      pdf.rect(MARGIN_X, y, CONTENT_WIDTH, 22, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      table.columns.forEach((column, index) => {
        pdf.text(column, MARGIN_X + index * columnWidth + 6, y + 14, {
          maxWidth: columnWidth - 12,
        });
      });
      y += 22;
    };
    drawHeader();
    table.rows.forEach((row, rowIndex) => {
      const lineSets = row.map((cell) =>
        pdf.splitTextToSize(String(cell ?? ""), columnWidth - 12),
      );
      const rowHeight = Math.max(22, Math.max(...lineSets.map((lines) => lines.length)) * 10 + 8);
      if (y + rowHeight > PAGE_HEIGHT - BOTTOM_CONTENT) {
        addPage();
        sectionHeading(`${table.title} (continued)`);
        drawHeader();
      }
      if (rowIndex % 2 === 0) {
        pdf.setFillColor(...MINT);
        pdf.rect(MARGIN_X, y, CONTENT_WIDTH, rowHeight, "F");
      }
      pdf.setDrawColor(...BORDER);
      pdf.line(MARGIN_X, y + rowHeight, PAGE_WIDTH - MARGIN_X, y + rowHeight);
      pdf.setTextColor(...NAVY);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      lineSets.forEach((lines, index) => {
        pdf.text(lines, MARGIN_X + index * columnWidth + 6, y + 13, {
          maxWidth: columnWidth - 12,
        });
      });
      y += rowHeight;
    });
    y += 16;
  };

  drawPageHeader();
  pdf.setTextColor(...NAVY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(23);
  const titleLines = pdf.splitTextToSize(data.title, CONTENT_WIDTH);
  pdf.text(titleLines, MARGIN_X, y);
  y += titleLines.length * 27 + 4;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...MUTED);
  pdf.text(data.dateRange, MARGIN_X, y);
  y += 16;
  pdf.text(`Generated ${data.generatedAt}`, MARGIN_X, y);
  y += 23;

  if (data.metadata.length > 0) {
    ensureSpace(data.metadata.length * 16 + 18);
    pdf.setFillColor(...MINT);
    pdf.roundedRect(MARGIN_X, y, CONTENT_WIDTH, data.metadata.length * 16 + 12, 5, 5, "F");
    let metadataY = y + 17;
    data.metadata.forEach((item) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...EMERALD);
      pdf.text(`${item.label}:`, MARGIN_X + 10, metadataY);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...NAVY);
      pdf.text(item.value, MARGIN_X + 92, metadataY, { maxWidth: CONTENT_WIDTH - 112 });
      metadataY += 16;
    });
    y += data.metadata.length * 16 + 24;
  }

  sectionHeading("Financial summary");
  const metricWidth = (CONTENT_WIDTH - 10) / 2;
  data.metrics.forEach((metric, index) => {
    if (index % 2 === 0) ensureSpace(62);
    const column = index % 2;
    const x = MARGIN_X + column * (metricWidth + 10);
    pdf.setFillColor(250, 252, 251);
    pdf.setDrawColor(...BORDER);
    pdf.roundedRect(x, y, metricWidth, 52, 5, 5, "FD");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(metric.label, x + 10, y + 14);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(...NAVY);
    pdf.text(pdf.splitTextToSize(metric.value, metricWidth - 20), x + 10, y + 34);
    if (metric.note) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...MUTED);
      pdf.text(metric.note, x + 10, y + 46, { maxWidth: metricWidth - 20 });
    }
    if (column === 1 || index === data.metrics.length - 1) y += 62;
  });

  if (data.insights.length > 0) {
    sectionHeading("What changed");
    data.insights.forEach((insight) => {
      const lines = pdf.splitTextToSize(insight, CONTENT_WIDTH - 24);
      const height = lines.length * 11 + 16;
      ensureSpace(height);
      pdf.setFillColor(...MINT);
      pdf.roundedRect(MARGIN_X, y, CONTENT_WIDTH, height, 4, 4, "F");
      pdf.setFillColor(...EMERALD);
      pdf.circle(MARGIN_X + 11, y + 12, 2.5, "F");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...NAVY);
      pdf.text(lines, MARGIN_X + 21, y + 14);
      y += height + 6;
    });
    y += 8;
  }

  const tables = data.tables.filter(
    (table) => mode === "detailed" || table.summaryOnly,
  );
  for (const table of tables) drawTable(table);

  if (mode === "detailed") {
    const html2canvas =
      data.chartElementIds.length > 0 && typeof document !== "undefined"
        ? (await import("html2canvas")).default
        : undefined;
    if (html2canvas) {
      for (const elementId of data.chartElementIds) {
        const element = document.getElementById(elementId);
        if (!element) continue;
        try {
          element.classList.add("render-for-export");
          const canvas = await html2canvas(element, {
            allowTaint: true,
            useCORS: true,
            backgroundColor: "#ffffff",
            scale: 2,
            logging: false,
          });
          element.classList.remove("render-for-export");
          const imageWidth = CONTENT_WIDTH;
          const imageHeight = Math.min(
            (canvas.height / canvas.width) * imageWidth,
            PAGE_HEIGHT - TOP_CONTENT - BOTTOM_CONTENT,
          );
          ensureSpace(imageHeight + 36);
          sectionHeading(element.getAttribute("data-pdf-title") ?? "Report chart");
          pdf.addImage(
            canvas.toDataURL("image/jpeg", 0.92),
            "JPEG",
            MARGIN_X,
            y,
            imageWidth,
            imageHeight,
            undefined,
            "FAST",
          );
          y += imageHeight + 18;
        } catch (error) {
          element.classList.remove("render-for-export");
          console.warn("Skipping a chart that could not be added to the PDF", error);
        }
      }
    }

    drawTable({
      title: "Transaction detail",
      description: "All entries included by the report filters.",
      columns: ["Date", "Description", "Account", "Category", "Type", "Amount"],
      rows: data.transactions.map((transaction) => [
        transaction.date.slice(0, 10),
        transaction.description || "",
        data.accountName(transaction.accountId),
        transaction.category || "Uncategorized",
        transaction.type === "transfer"
          ? `Transfer ${transaction.transferDirection ?? ""}`.trim()
          : transaction.type,
        `${transaction.type === "expense" || transaction.transferDirection === "out" ? "-" : "+"}${currencyAmount(transaction.amount)}`,
      ]),
    });
  }

  const pageCount = pdf.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber);
    drawPageFooter(pageNumber, pageCount);
  }
  pdf.setProperties({
    title: data.title,
    subject: `${mode === "summary" ? "Summary" : "Detailed"} Ledgerly financial report`,
    author: "Ledgerly Pro",
    creator: "Ledgerly Pro",
  });
  return pdf;
}

export async function buildReportPdfBytes(
  data: ReportPdfData,
  mode: ReportPdfMode,
) {
  const pdf = await createReportPdf(data, mode);
  return new Uint8Array(pdf.output("arraybuffer"));
}

export async function generateReportPdf(
  data: ReportPdfData,
  mode: ReportPdfMode,
) {
  const pdf = await createReportPdf(data, mode);
  pdf.save(`${safeFilename(data.title)}-${mode}.pdf`);
}
