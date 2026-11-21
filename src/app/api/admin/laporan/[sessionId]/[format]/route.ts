import { reportPdf, reportWorkbook, sessionReport } from "@/server/reports";
import { requirePageUser } from "@/server/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ sessionId: string; format: string }> };

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Hapus karakter khusus kecuali spasi dan dash
    .replace(/\s+/g, "-") // Ganti spasi dengan dash
    .replace(/-+/g, "-") // Hapus dash berulang
    .trim();
}

function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(_req: Request, ctx: Ctx) {
  await requirePageUser(["ADMIN"]);
  const { sessionId, format } = await ctx.params;
  const report = await sessionReport(Number(sessionId));

  const sanitizedExamName = sanitizeFilename(report.examName);
  const formattedDate = formatDateForFilename(report.startsAt);
  const baseFilename = `laporan-ujian-${sanitizedExamName}-${formattedDate}`;

  if (format === "excel") {
    const body = reportWorkbook(report);
    return new Response(body, {
      headers: {
        "content-type": "application/vnd.ms-excel; charset=utf-8",
        "content-disposition": `attachment; filename="${baseFilename}.xls"`,
      },
    });
  }
  if (format === "pdf") {
    const body = await reportPdf(report);
    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${baseFilename}.pdf"`,
      },
    });
  }
  return Response.json({ error: "Format tidak dikenal." }, { status: 404 });
}
