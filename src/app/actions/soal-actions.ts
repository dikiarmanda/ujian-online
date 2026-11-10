"use server";

import { cookies } from "next/headers";
import { deleteQuestion, toggleQuestionStatus } from "@/server/questions";
import { AppError } from "@/server/errors";
import { readSession, type SessionRecord } from "@/server/session";

async function requireActionUser(): Promise<SessionRecord> {
  const jar = await cookies();
  const sid = jar.get("sid")?.value;
  if (!sid) throw new AppError("Sesi tidak ditemukan. Masuk kembali.", 401);
  const session = await readSession(sid);
  if (!session) throw new AppError("Sesi berakhir. Masuk kembali.", 401);
  return session;
}

/**
 * Server Action untuk menonaktifkan soal
 *
 * Contoh penggunaan di frontend:
 * ```tsx
 * <form action={handleDeactivate}>
 *   <input type="hidden" name="questionId" value={questionId} />
 *   <button type="submit">Nonaktifkan</button>
 * </form>
 * ```
 */
async function handleDeactivate(formData: FormData) {
  try {
    const user = await requireActionUser();
    const questionId = Number(formData.get("questionId"));

    if (!questionId || isNaN(questionId)) {
      throw new AppError("ID soal tidak valid.", 400);
    }

    // toggleQuestionStatus akan memanggil validateDeleteOrDeactivateQuestion
    // secara otomatis jika newStatus = false
    await toggleQuestionStatus(questionId, user.userId);

    return { success: true, message: "Soal berhasil dinonaktifkan." };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    console.error(error);
    return { success: false, error: "Terjadi kesalahan di server. Coba lagi." };
  }
}

/**
 * Server Action untuk menghapus soal (soft delete)
 *
 * Contoh penggunaan di frontend:
 * ```tsx
 * <form action={handleDelete}>
 *   <input type="hidden" name="questionId" value={questionId} />
 *   <button type="submit" onClick={(e) => {
 *     if (!confirm("Hapus soal ini?")) e.preventDefault();
 *   }}>
 *     Hapus
 *   </button>
 * </form>
 * ```
 */
async function handleDelete(formData: FormData) {
  try {
    const user = await requireActionUser();
    const questionId = Number(formData.get("questionId"));

    if (!questionId || isNaN(questionId)) {
      throw new AppError("ID soal tidak valid.", 400);
    }

    // deleteQuestion akan memanggil validateDeleteOrDeactivateQuestion
    // untuk mencegah penghapusan soal yang sedang dipakai ujian aktif
    await deleteQuestion(questionId, user.userId);

    return { success: true, message: "Soal berhasil dihapus." };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    console.error(error);
    return { success: false, error: "Terjadi kesalahan di server. Coba lagi." };
  }
}

/**
 * Alternatif: API Route untuk bulk actions
 *
 * Contoh penggunaan di frontend:
 * ```tsx
 * const response = await fetch('/api/admin/bulk-hapus-soal', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ ids: [1, 2, 3] }),
 * });
 * const result = await response.json();
 * if (!response.ok) {
 *   alert(result.error || 'Gagal menghapus soal');
 * }
 * ```
 */

export { handleDeactivate, handleDelete };
