import { NextResponse } from "next/server";
import { loadContributorsDataset } from "@/lib/stats/contributors-dataset";

export const dynamic = "force-static";

export async function GET() {
  const dataset = await loadContributorsDataset();
  return NextResponse.json(dataset.month);
}
