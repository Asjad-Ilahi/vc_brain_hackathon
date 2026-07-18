import OpportunityDetail from "@/app/_components/OpportunityDetail";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <OpportunityDetail id={id} />
    </main>
  );
}
