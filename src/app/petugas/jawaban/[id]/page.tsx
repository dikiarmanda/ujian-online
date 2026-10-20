import { GradeDesk } from "@/components/grade-desk";
import { AppBar } from "@/components/chrome";
import { requirePageUser } from "@/server/current-user";

export const dynamic = "force-dynamic";

export default async function NilaiPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser(["GRADER"]);
  const { id } = await params;
  return (
    <div className="min-h-screen bg-page">
      <AppBar title="Penilaian uraian" name={user.name} role={user.role} />
      <main className="px-4 py-6 md:px-8">
        <GradeDesk answerId={Number(id)} />
      </main>
    </div>
  );
}
