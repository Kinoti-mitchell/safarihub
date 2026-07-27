import { CatalogPage, type CatalogSearch } from "@/components/catalog";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearch>;
}) {
  const search = await searchParams;
  return <CatalogPage search={search} />;
}
