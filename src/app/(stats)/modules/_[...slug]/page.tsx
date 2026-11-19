import { notFound } from "next/navigation";
import { StatsPageHeader } from "@/components/stats/stats-page-header";
import { ModuleBreadcrumb } from "@/components/stats/module-breadcrumb";
import { ModuleDetail } from "@/components/stats/module-detail";
import { ModuleTree } from "@/components/stats/module-tree";
import { collectFolderPaths, findTreeNode } from "@/lib/stats/module-counts";
import { loadModuleCounts } from "@/lib/stats/module-counts-dataset";
import { loadModuleDetails } from "@/lib/stats/module-details-dataset";

// Disabled module pages: kept fully working in the underlying data/route for every other module —
// these specific fullnames are just excluded from the static build (and, for `next dev`, from the
// page itself below) so visiting them 404s instead of rendering.
const DISABLED_MODULE_FULLNAMES = new Set(["auxiliary/admin/2wire/xslt_password_reset"]);

export async function generateStaticParams() {
  const [moduleDetails, moduleCounts] = await Promise.all([loadModuleDetails(), loadModuleCounts()]);
  const modulePaths = [...moduleDetails.keys()].filter((fullname) => !DISABLED_MODULE_FULLNAMES.has(fullname)).map((fullname) => fullname.split("/"));
  const folderPaths = collectFolderPaths(moduleCounts.tree);
  return [...modulePaths, ...folderPaths].map((slug) => ({ slug }));
}

export default async function ModulesSlugPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const fullname = slug.join("/");
  if (DISABLED_MODULE_FULLNAMES.has(fullname)) notFound();

  const [moduleDetails, moduleCounts] = await Promise.all([loadModuleDetails(), loadModuleCounts()]);

  const module = moduleDetails.get(fullname);
  if (module) {
    return (
      <>
        <ModuleBreadcrumb slugSegments={module.slugSegments} />
        <StatsPageHeader title={module.name} description={module.fullname} />
        <ModuleDetail module={module} />
      </>
    );
  }

  const folder = findTreeNode(moduleCounts.tree, slug);
  if (!folder) notFound();

  return (
    <>
      <ModuleBreadcrumb slugSegments={slug} />
      <StatsPageHeader title={folder.name} description={`${folder.total.toLocaleString()} modules under ${fullname}/`} />
      <ModuleTree nodes={folder.children} />
    </>
  );
}
