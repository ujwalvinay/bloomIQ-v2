import { Suspense } from "react";
import { PlantsPageContent } from "@/components/plants/PlantsPageContent";

function PlantsLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-plants-canvas px-8">
      <p className="text-sm text-muted">Loading your collection…</p>
    </div>
  );
}

export default function PlantsPage() {
  return (
    <Suspense fallback={<PlantsLoading />}>
      <PlantsPageContent />
    </Suspense>
  );
}
