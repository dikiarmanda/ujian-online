import { prisma } from "./db";
import { ombn } from "./ombn-db";

/**
 * Daftar ID lomba (competition) yang boleh diakses user petugas,
 * diambil dari field akses_lomba admin OMBN terkait externalId user.
 */
export async function getAksesLomba(userId: number): Promise<number[]> {
  const sessionUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { externalId: true },
  });

  if (!sessionUser?.externalId) {
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
    return parsed
      .map((id: bigint | number | string) => {
        const num = typeof id === "bigint" ? Number(id) : Number(id);
        return Number.isInteger(num) ? num : null;
      })
      .filter((id: number | null): id is number => id !== null);
  } catch (error) {
    console.error("Failed to get akses_lomba:", error);
    return [];
  }
}
