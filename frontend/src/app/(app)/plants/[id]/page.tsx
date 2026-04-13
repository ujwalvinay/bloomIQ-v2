import { redirect } from "next/navigation";

export default function PlantDetailIndexPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/plants/${params.id}/overview`);
}
