import { redirect } from "next/navigation";
import { browseHref } from "@/lib/categories";
import type { CatalogSearch } from "@/components/catalog";

export default async function ExploreRedirect({
  searchParams,
}: {
  searchParams: Promise<CatalogSearch>;
}) {
  const search = await searchParams;
  redirect(browseHref({ ...search, category: "explore" }));
}
