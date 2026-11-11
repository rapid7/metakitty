import { NextResponse } from "next/server";
import { loadLandedModuleCommits } from "@/lib/stats/module-commits-dataset";

export const dynamic = "force-static";

export async function GET() {
  const commits = await loadLandedModuleCommits();
  return NextResponse.json(commits);
}
