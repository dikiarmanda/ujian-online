import { reportPdf, reportWorkbook, sessionReport } from "@/server/reports";
import { requirePageUser } from "@/server/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ sessionId: string; format: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  await requirePageUser(["ADMIN"]);
  const { sessionId, format } = await ctx.params;
  const report = await sessionReport(Number(sessionId));
  if (format === "excel") {
    const body = reportWorkbook(report);
    return new Response(body, {
      headers: {
        "content-type": "application/vnd.ms-excel; charset=utf-8",
        "content-disposition": `attachment; filename="laporan-ujian-${sessionId}.xls"`,
      },
    });
  }
  if (format === "pdf") {
    const body = await reportPdf(report);
    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="laporan-ujian-${sessionId}.pdf"`,
      },
    });
  }
  return Response.json({ error: "Format tidak dikenal." }, { status: 404 });
}
