"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingState } from "@/components/ui/FeedbackStates";

function ReconciliationRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id");

  useEffect(() => {
    if (datasetId) {
      router.replace(`/dashboard?dataset_id=${encodeURIComponent(datasetId)}`);
    } else {
      router.replace("/dashboard");
    }
  }, [datasetId, router]);

  return <LoadingState message="Redirecting to Financial Overview..." />;
}

export default function ReconciliationPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading Financial Overview..." />}>
      <ReconciliationRedirect />
    </Suspense>
  );
}
