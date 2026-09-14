import { notFound } from "next/navigation";
import { restaurant } from "@/lib/data";
import { Menu } from "@/components/Menu";

export default function RestaurantMenuPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { mesa?: string };
}) {
  if (params.slug !== restaurant.slug) {
    notFound();
  }

  const tableNum = searchParams.mesa ? Number(searchParams.mesa) : null;
  const table = tableNum && Number.isFinite(tableNum) && tableNum > 0 ? tableNum : null;

  return <Menu restaurant={restaurant} table={table} />;
}
