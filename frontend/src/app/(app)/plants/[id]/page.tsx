import { PlantDetailContent } from "@/components/plants/PlantDetailContent";

export default function PlantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <PlantDetailContent plantId={params.id} />;
}
