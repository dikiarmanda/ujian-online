"use server";

import { z } from "zod";
import { requireApiUser, requestIp, withErrors } from "@/server/http";
import { deleteQuestion, toggleQuestionStatus } from "@/server/questions";
import { AppError } from "@/server/errors";

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
  return withErrors(async () => {
    const user = await requireApiUser();
    const questionId = Number(formData.get("questionId"));
    const ip = requestIp();

    if (!questionId || isNaN(questionId)) {
      throw new AppError("ID soal tidak valid.", 400);
    }

    // toggleQuestionStatus akan memanggil validateDeleteOrDeactivateQuestion
    // secara otomatis jika newStatus = false
    await toggleQuestionStatus(questionId, user.userId, ip);

    return { success: true, message: "Soal berhasil dinonaktifkan." };
  });
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
  return withErrors(async () => {
    const user = await requireApiUser();
    const questionId = Number(formData.get("questionId"));
    const ip = requestIp();

    if (!questionId || isNaN(questionId)) {
      throw new AppError("ID soal tidak valid.", 400);
    }

    // deleteQuestion akan memanggil validateDeleteOrDeactivateQuestion
    // untuk mencegah penghapusan soal yang sedang dipakai ujian aktif
    await deleteQuestion(questionId, user.userId, ip);

    return { success: true, message: "Soal berhasil dihapus." };
  });
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
