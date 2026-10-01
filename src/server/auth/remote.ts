import { z } from "zod";
import { env } from "../env";
import { OriginDownError, OriginRejectedError } from "../errors";
import type { AuthProvider, OriginUser, ParticipantPage } from "./types";

const userSchema = z.object({
  success: z.literal(true),
  external_id: z.string().min(1),
  nama: z.string().min(1),
  role: z.enum(["peserta", "admin", "petugas"]),
  kelompok: z.string().nullable().optional(),
});

const failSchema = z.object({
  success: z.literal(false),
  message: z.string().optional(),
});

const pageSchema = z.object({
  items: z.array(
    z.object({
      external_id: z.string(),
      nama: z.string(),
      identitas: z.string(),
      kelompok: z.string().nullable().optional(),
      role: z.enum(["peserta", "admin", "petugas"]).default("peserta"),
    }),
  ),
  has_more: z.boolean().optional(),
});

async function originFetch(path: string, init: RequestInit): Promise<Response> {
  const config = env();
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(new URL(path, config.originBaseUrl), {
        ...init,
        signal: controller.signal,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${config.originApiKey}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...init.headers,
        },
      });
      if (response.status >= 500 && attempt === 0) {
        lastStatus = response.status;
        continue;
      }
      return response;
    } catch {
      if (attempt === 1) throw new OriginDownError();
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastStatus) throw new OriginDownError();
  throw new OriginDownError();
}

function toUser(identity: string, data: z.infer<typeof userSchema>): OriginUser {
  return {
    externalId: data.external_id,
    name: data.nama,
    identity,
    role: data.role,
    groupName: data.kelompok ?? null,
  };
}

export const remoteAuthProvider: AuthProvider = {
  async login(identity: string, password: string): Promise<OriginUser> {
    const response = await originFetch("/login", {
      method: "POST",
      body: JSON.stringify({ identitas: identity, password }),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) throw new OriginRejectedError();
    if (!response.ok) throw new OriginDownError();
    const ok = userSchema.safeParse(payload);
    if (ok.success) return toUser(identity, ok.data);
    if (failSchema.safeParse(payload).success) throw new OriginRejectedError();
    throw new OriginDownError();
  },

  async listParticipants(page: number, updatedSince?: string): Promise<ParticipantPage> {
    const query = new URLSearchParams({ page: String(page) });
    if (updatedSince) query.set("updated_since", updatedSince);
    const response = await originFetch(`/peserta?${query.toString()}`, { method: "GET" });
    if (!response.ok) {
      throw new OriginDownError(
        "Layanan data peserta sedang tidak dapat dihubungi. Coba lagi dalam beberapa saat.",
      );
    }
    const payload: unknown = await response.json().catch(() => null);
    const parsed = pageSchema.safeParse(payload);
    if (!parsed.success) {
      throw new OriginDownError(
        "Layanan data peserta sedang tidak dapat dihubungi. Coba lagi dalam beberapa saat.",
      );
    }
    return {
      hasMore: Boolean(parsed.data.has_more),
      items: parsed.data.items.map((item) => ({
        externalId: item.external_id,
        name: item.nama,
        identity: item.identitas,
        role: item.role,
        groupName: item.kelompok ?? null,
      })),
    };
  },
};
