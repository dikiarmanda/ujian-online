import { prisma } from "@/server/db";
import { json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const examId = Number(id);

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      phase: true,
      startedAt: true,
    },
  });

  return json({ exam });
}
