import { auth } from "@/lib/auth";
import { listBookingsForProviderUser } from "@/lib/provider-bookings";
import {
  ProviderBookingsClient,
  type ProviderBookingRow,
} from "./bookings-client";

export default async function ProviderBookingsPage() {
  const session = await auth();
  const rows = session?.user
    ? await listBookingsForProviderUser({
        userId: session.user.id,
        role: session.user.role,
      })
    : [];

  return (
    <ProviderBookingsClient
      initialBookings={rows as unknown as ProviderBookingRow[]}
    />
  );
}
