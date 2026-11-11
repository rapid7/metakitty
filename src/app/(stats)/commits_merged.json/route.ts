import { NextResponse } from "next/server";
import { loadHistoricalDataset } from "@/lib/stats/dataset";
import { getRecentlyMergedPrs } from "@/lib/stats/commits-merged";

export const dynamic = "force-static";

export async function GET() {
  const dataset = await loadHistoricalDataset();
  return NextResponse.json(getRecentlyMergedPrs(dataset.issues));
}
