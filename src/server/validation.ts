import { prisma } from "./db";
import { AppError } from "./errors";

/**
 * Mencegah soal dinonaktifkan/dihapus jika sedang dipakai di ujian yang aktif.
 *
 * @throws {AppError} - Jika soal digunakan di ujian dengan status PUBLISHED atau phase RUNNING/NOT_STARTED
 */
export async function validateDeleteOrDeactivateQuestion(questionId: number) {
  // Cari package yang menggunakan soal ini
  const packageItems = await prisma.questionPackageItem.findMany({
    where: { questionId },
    select: { packageId: true },
  });

  if (packageItems.length === 0) {
    return; // Soal tidak dipakai di paket manapun, aman untuk dihapus/nonaktifkan
  }

  const packageIds = packageItems.map((item) => item.packageId);

  // Cek apakah package ini digunakan di ExamPackage yang terhubung ke Exam aktif
  const activeExams = await prisma.exam.findMany({
    where: {
      deletedAt: null,
      packages: {
        some: {
          packageId: { in: packageIds },
        },
      },
      OR: [
        { status: "PUBLISHED" },
        { phase: { in: ["RUNNING"] } },
      ],
    },
    select: {
      id: true,
      name: true,
      status: true,
      phase: true,
    },
  });
  console.log("activeExams", activeExams);
  if (activeExams.length > 0) {
    const examNames = activeExams.map((e) => e.name).join(", ");
    throw new AppError(
      `Gagal. Soal ini sedang digunakan pada ujian "${examNames}" yang sedang berlangsung atau akan datang.`,
      409,
    );
  }
}

/**
 * Mencegah Admin mengedit isi paket (menambah/hapus soal) jika paket sedang dipakai ujian aktif.
 *
 * @throws {AppError} - Jika paket digunakan di ujian dengan status PUBLISHED atau phase RUNNING/NOT_STARTED
 */
export async function validateUpdatePackage(packageId: number) {
  // Cek apakah package ini digunakan di ExamPackage yang terhubung ke Exam aktif
  const activeExams = await prisma.exam.findMany({
    where: {
      deletedAt: null,
      packages: {
        some: {
          packageId,
        },
      },
      OR: [
        { status: "PUBLISHED" },
        { phase: { in: ["RUNNING"] } },
      ],
    },
    select: {
      id: true,
      name: true,
      status: true,
      phase: true,
    },
  });

  if (activeExams.length > 0) {
    const examNames = activeExams.map((e) => e.name).join(", ");
    throw new AppError(
      `Gagal. Paket soal ini dikunci karena sedang digunakan pada ujian "${examNames}" yang aktif. Selesaikan atau batalkan jadwal ujian terlebih dahulu.`,
      409,
    );
  }
}

/**
 * Memastikan paket bersih dari soal nonaktif/dihapus saat dipilih untuk jadwal ujian.
 *
 * @returns { validCount: number } - Jumlah soal yang valid (aktif dan tidak dihapus)
 * @throws {AppError} - Jika ada soal yang nonaktif atau sudah dihapus
 */
export async function validateScheduleExam(packageId: number, jenjang: string): Promise<{ validCount: number }> {
  // Ambil semua soal di dalam package
  const packageItems = await prisma.questionPackageItem.findMany({
    where: { packageId },
    select: {
      questionId: true,
    },
  });

  if (packageItems.length === 0) {
    throw new AppError("Gagal. Paket soal ini kosong. Tambahkan soal terlebih dahulu.", 400);
  }

  const questionIds = packageItems.map((item) => item.questionId);

  // Cek soal yang nonaktif atau sudah dihapus
  const invalidQuestions = await prisma.question.findMany({
    where: {
      id: { in: questionIds },
      OR: [{ isActive: false }, { deletedAt: { not: null } }],
    },
    select: {
      id: true,
      code: true,
      isActive: true,
      deletedAt: true,
    },
  });

  if (invalidQuestions.length > 0) {
    const inactiveCount = invalidQuestions.filter((q) => !q.isActive).length;
    const deletedCount = invalidQuestions.filter((q) => q.deletedAt !== null).length;

    const details: string[] = [];
    if (inactiveCount > 0) details.push(`${inactiveCount} dinonaktifkan`);
    if (deletedCount > 0) details.push(`${deletedCount} dihapus`);

    throw new AppError(
      `Gagal. Paket soal memiliki ${invalidQuestions.length} soal yang ${details.join(" dan ")}. Harap perbaiki isi paket atau buat paket baru.`,
      400,
    );
  }

  return { validCount: questionIds.length };
}
