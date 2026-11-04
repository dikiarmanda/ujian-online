import Link from "next/link";
import { PetugasShell } from "@/components/petugas-shell";
import { PaginatedDataTable } from "@/components/data-table";
import { formatJakarta } from "@/lib/format";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { ombn } from "@/server/ombn-db";

export const dynamic = "force-dynamic";

async function getAksesLomba(userId: number): Promise<number[]> {
  const sessionUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { externalId: true },
  });

  if (!sessionUser) {
    return [];
  }

  if (!sessionUser.externalId) {
    return [];
  }

  const adminIdMatch = sessionUser.externalId.match(/ombn-admin:(\d+)/);
  if (!adminIdMatch) {
    return [];
  }

  try {
    const adminId = BigInt(adminIdMatch[1]);
    const admin = await ombn.admins.findUnique({
      where: { id: adminId },
      select: { akses_lomba: true },
    });

    if (!admin?.akses_lomba) {
      return [];
    }

    const parsed = Array.isArray(admin.akses_lomba) ? admin.akses_lomba : JSON.parse(JSON.stringify(admin.akses_lomba));
    return parsed.map((id: bigint | number | string) => {
      const num = typeof id === 'bigint' ? Number(id) : Number(id);
      return Number.isInteger(num) ? num : null;
    }).filter((id: number | null): id is number => id !== null);
  } catch (error) {
    console.error("Failed to get akses_lomba:", error);
    return [];
  }
}

export default async function PaketPreviewPage() {
  const user = await requirePageUser(["GRADER"]);
  const aksesLomba = await getAksesLomba(user.userId);

  const exams = await prisma.exam.findMany({
    where: {
      status: "PUBLISHED",
      ...(aksesLomba.length > 0 ? { competitionId: { in: aksesLomba } } : {}),
    },
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      name: true,
      competitionId: true,
      startsAt: true,
      durationMinutes: true,
      packages: {
        select: {
          id: true,
          jenjang: true,
          packageId: true,
          questionPackage: {
            select: {
              id: true,
              name: true,
              _count: {
                select: {
                  items: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const packageRows = exams.flatMap((exam) =>
    exam.packages.map((pkg) => ({
      examId: exam.id,
      examName: exam.name,
      competitionId: exam.competitionId,
      packageId: pkg.packageId,
      packageName: pkg.questionPackage.name,
      jenjang: pkg.jenjang,
      questionCount: pkg.questionPackage._count.items,
      startsAt: exam.startsAt,
      questionPackageId: pkg.questionPackage.id,
    }))
  );

  return (
    <PetugasShell name={user.name} current="/petugas/paket">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Preview Paket Soal</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {aksesLomba.length > 0
              ? `Menampilkan paket dari ${aksesLomba.length} lomba yang Anda akses`
              : "Menampilkan semua paket soal"}
          </p>
        </header>

        <section className="rounded-xl border border-line/80 bg-paper shadow-sm">
          {packageRows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-ink-muted">
              {aksesLomba.length > 0
                ? "Tidak ada paket soal untuk lomba yang Anda akses."
                : "Belum ada paket soal."}
            </div>
          ) : (
            <PaginatedDataTable
              headers={["Nama Paket", "Ujian", "Jenjang", "Jumlah Soal", "Mulai", ""]}
              rows={packageRows.map((row) => [
                <span key={`${row.questionPackageId}-name`} className="font-semibold text-ink">{row.packageName}</span>,
                <span key={`${row.questionPackageId}-exam`} className="text-sm text-ink">{row.examName}</span>,
                <span key={`${row.questionPackageId}-jenjang`} className="text-sm text-ink-muted">{row.jenjang}</span>,
                <span key={`${row.questionPackageId}-count`} className="text-sm font-digits text-ink tabular-nums">{row.questionCount}</span>,
                <span key={`${row.questionPackageId}-starts`} className="text-xs text-ink-muted">{formatJakarta(row.startsAt)}</span>,
                <Link
                  key={`${row.questionPackageId}-preview`}
                  href={`/petugas/paket/${row.questionPackageId}/preview`}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-line-strong bg-paper px-3 text-sm font-semibold text-ink shadow-sm transition hover:border-brand hover:text-brand">
                  Preview
                </Link>,
              ])}
              searchPlaceholder="Cari nama paket atau ujian"
            />
          )}
        </section>
      </div>
    </PetugasShell>
  );
}
