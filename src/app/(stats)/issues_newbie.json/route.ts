import { NextResponse } from "next/server";
import { loadHistoricalDataset } from "@/lib/stats/dataset";
import { getNewbieFriendlyIssues } from "@/lib/stats/issues-newbie";

export const dynamic = "force-static";

export async function GET() {
  const dataset = await loadHistoricalDataset();
  return NextResponse.json(getNewbieFriendlyIssues(dataset.issues));
}
