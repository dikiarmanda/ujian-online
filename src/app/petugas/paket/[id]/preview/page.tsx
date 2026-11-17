import Link from "next/link";
import { notFound } from "next/navigation";
import { PackagePreview, type PackageQuestion } from "@/components/package-preview";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";
import { requirePageUser } from "@/server/current-user";
import { getAksesLomba } from "@/server/akses-lomba";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function PackagePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser(["GRADER"]);
  const { id } = await params;
  const packageId = Number(id);
  if (!Number.isFinite(packageId)) notFound();

  const aksesLomba = await getAksesLomba(user.userId);

  // Check if the package is used in any exam that the petugas has access to
  const examPackage = await prisma.examPackage.findFirst({
    where: {
      packageId,
      exam: {
        ...(aksesLomba.length > 0 ? { competitionId: { in: aksesLomba } } : {}),
      },
    },
    include: {
      exam: {
        select: {
          id: true,
          name: true,
          competitionId: true,
        },
      },
    },
  });

  if (!examPackage) {
    notFound();
  }

  const pack = await prisma.questionPackage.findUnique({
    where: { id: packageId, deletedAt: null },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          question: {
            include: {
              options: { orderBy: { sortOrder: "asc" } },
              essayKey: true,
              shortAnswerKey: true,
            },
          },
        },
      },
    },
  });

  if (!pack) notFound();

  const questions: PackageQuestion[] = pack.items.map((item) => ({
    id: item.question.id,
    type: item.question.type,
    body: item.question.body,
    imagePath: item.question.imagePath,
    weight: item.weight.toString(),
    wrongWeight: item.wrongWeight.toString(),
    code: item.question.code,
    options: item.question.options.map((opt) => ({
      id: opt.id,
      label: opt.label,
      body: opt.body,
      imagePath: opt.imagePath,
      isCorrect: opt.isCorrect,
    })),
    essayKey: item.question.essayKey?.answerKey,
    essayRubric: item.question.essayKey?.rubric ?? undefined,
    shortAnswerKey: item.question.shortAnswerKey?.answerKey,
  }));

  return (
    <div className="min-h-screen">
      <div className="border-b border-line bg-paper px-4 py-3 lg:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/petugas/paket" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
              <FontAwesomeIcon icon={Icon.ArrowLeft} className="size-3.5" />
              Kembali ke daftar paket
            </Link>
            <span className="text-ink-muted">/</span>
            <span className="text-sm font-semibold text-ink">Preview: {pack.name}</span>
          </div>
          <span className="text-xs text-ink-muted">{questions.length} soal</span>
        </div>
      </div>
      <PackagePreview questions={questions} />
    </div>
  );
}
