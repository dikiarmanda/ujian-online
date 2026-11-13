import { json, requireApiUser, withErrors } from "@/server/http";
import { storeQuestionImage } from "@/server/image-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withErrors(async () => {
    await requireApiUser(req, ["ADMIN"]);

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new Error("Berkas tidak ada.");
    }

    if (!file.type.startsWith("image/")) {
      throw new Error("Hanya berkas gambar yang diizinkan.");
    }

    if (file.size > 5_000_000) {
      throw new Error("Unggah gambar maksimal 5 MB.");
    }

    const result = await storeQuestionImage(file);
    return json(result);
  });
}
