import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getProviderForUser } from "@/lib/provider";
import { dateKey, getRoomInventory } from "@/lib/availability";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

function utcDay(isoOrDate: string | Date) {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function localTodayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);
    const { id: listingId } = await params;
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const roomTypeId = searchParams.get("roomTypeId") || undefined;

    const { data: listing, error: findError } = await db
      .from("Listing")
      .select(
        "*, provider:Provider(id, createdAt), roomTypes:RoomType(*)",
      )
      .eq("id", listingId)
      .order("createdAt", { referencedTable: "roomTypes", ascending: true })
      .maybeSingle();
    if (findError) throw findError;
    if (!listing) return jsonError("Not found", 404);

    const access = await getProviderForUser(session.user.id);
    const isAdmin = session.user.role === "ADMIN";
    if (!isAdmin && access?.provider.id !== listing.providerId) {
      return jsonError("Forbidden", 403);
    }

    const registeredOn = utcDay(listing.provider.createdAt);
    const registeredDate = dateKey(registeredOn);
    const today = utcDay(localTodayIso());

    // Filter range (defaults: today → today)
    let from = utcDay(fromParam || localTodayIso());
    let to = utcDay(toParam || fromParam || localTodayIso());

    if (from < registeredOn) from = registeredOn;
    if (to < from) to = from;

    const fromKey = dateKey(from);
    const toKey = dateKey(to);

    const allRoomTypes = (listing.roomTypes ?? []) as Array<{
      id: string;
      quantity: number;
    }>;
    const roomTypes = roomTypeId
      ? allRoomTypes.filter((r) => r.id === roomTypeId)
      : allRoomTypes;

    if (roomTypeId && !roomTypes.length) {
      return jsonError("Room type not found on this listing", 404);
    }

    const perRoom = [];
    for (const rt of roomTypes) {
      const inventory = await getRoomInventory({
        roomTypeId: rt.id,
        from,
        to,
      });
      const days = inventory.days;
      const openValues = days.map((d) => d.available);
      const bookedValues = days.map((d) => d.booked);
      const minOpen = openValues.length ? Math.min(...openValues) : rt.quantity;
      const maxBooked = bookedValues.length ? Math.max(...bookedValues) : 0;
      const openOnFrom =
        days.find((d) => d.date === fromKey)?.available ?? rt.quantity;
      const bookedOnFrom =
        days.find((d) => d.date === fromKey)?.booked ?? 0;
      const bookedRoomNights = days.reduce((s, d) => s + d.booked, 0);

      perRoom.push({
        room: inventory.room,
        days,
        summary: {
          totalRooms: inventory.room.quantity,
          openOnFrom,
          bookedOnFrom,
          minOpen,
          maxBooked,
          bookedRoomNights,
          // aliases for existing UI cards
          openToday: minOpen,
          bookedToday: maxBooked,
          openOnDate: minOpen,
          bookedOnDate: maxBooked,
        },
      });
    }

    const summary = {
      totalRooms: perRoom.reduce((s, r) => s + r.summary.totalRooms, 0),
      minOpen: perRoom.reduce((s, r) => s + r.summary.minOpen, 0),
      maxBooked: perRoom.reduce((s, r) => s + r.summary.maxBooked, 0),
      openToday: perRoom.reduce((s, r) => s + r.summary.minOpen, 0),
      bookedToday: perRoom.reduce((s, r) => s + r.summary.maxBooked, 0),
      bookedRoomNights: perRoom.reduce(
        (s, r) => s + r.summary.bookedRoomNights,
        0,
      ),
      roomTypeCount: perRoom.length,
      from: fromKey,
      to: toKey,
      isSingleDay: fromKey === toKey,
    };

    return jsonOk({
      filter: roomTypeId || "all",
      registeredOn: registeredDate,
      from: fromKey,
      to: toKey,
      today: dateKey(today),
      summary,
      roomTypes: perRoom,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
