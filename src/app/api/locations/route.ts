import { db } from "@/lib/supabase";
import { handleRouteError, jsonOk } from "@/lib/http";

/** Public cascade: countries → counties → towns */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countryId = searchParams.get("countryId");
    const countyId = searchParams.get("countyId");

    if (countyId) {
      const { data: towns, error } = await db
        .from("Town")
        .select("*")
        .eq("countyId", countyId)
        .order("name", { ascending: true });
      if (error) throw error;
      return jsonOk({ towns });
    }

    if (countryId) {
      const { data: counties, error } = await db
        .from("County")
        .select("*")
        .eq("countryId", countryId)
        .order("name", { ascending: true });
      if (error) throw error;
      return jsonOk({ counties });
    }

    const { data: countries, error } = await db
      .from("Country")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return jsonOk({ countries });
  } catch (error) {
    return handleRouteError(error);
  }
}
