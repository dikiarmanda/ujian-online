import type { AuthProvider, OriginUser, ParticipantPage } from "./types";

const SAMPLES: Record<string, OriginUser> = {
  admin: {
    externalId: "mock:admin",
    name: "Admin Contoh",
    identity: "admin",
    role: "admin",
    groupName: null,
  },
  petugas: {
    externalId: "mock:petugas",
    name: "Petugas Contoh",
    identity: "petugas",
    role: "petugas",
    groupName: null,
  },
  peserta: {
    externalId: "mock:peserta",
    name: "Peserta Contoh",
    identity: "peserta",
    role: "peserta",
    groupName: "Kelas 9A",
  },
};

function participant(identity: string, name?: string, groupName?: string): OriginUser {
  return {
    externalId: `mock:${identity}`,
    name: name || identity,
    identity,
    role: "peserta",
    groupName: groupName ?? null,
  };
}

export const mockAuthProvider: AuthProvider = {
  async login(identity: string): Promise<OriginUser> {
    const known = SAMPLES[identity.trim().toLowerCase()];
    if (known) return known;
    return participant(identity.trim());
  },

  async listParticipants(page: number): Promise<ParticipantPage> {
    if (page <= 1) {
      return {
        items: [participant("peserta", "Peserta Contoh", "Kelas 9A"), participant("siswa-a", "Siswa A", "Kelas 9A"), participant("siswa-b", "Siswa B", "Kelas 9B")],
        hasMore: true,
      };
    }
    return {
      items: [participant("siswa-c", "Siswa C", "Kelas 9B"), { externalId: "", name: "", identity: "rusak", role: "peserta" }],
      hasMore: false,
    };
  },
};
