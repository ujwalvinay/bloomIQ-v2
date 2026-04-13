import type { ReactNode } from "react";
import { PlantDetailShell } from "@/components/plants/PlantDetailShell";

export default function PlantDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { id: string };
}) {
  return <PlantDetailShell plantId={params.id}>{children}</PlantDetailShell>;
}
