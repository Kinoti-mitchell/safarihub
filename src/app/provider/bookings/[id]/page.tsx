import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getBookingForProviderReview } from "@/lib/provider-bookings";
import {
  ProviderBookingDetailClient,
  type BookingDetail,
  type PriorBooking,
} from "./booking-detail-client";

type Params = { params: Promise<{ id: string }> };

export default async function ProviderBookingDetailPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/provider/bookings");

  const { id } = await params;
  const result = await getBookingForProviderReview({
    bookingId: id,
    userId: session.user.id,
    role: session.user.role,
  });
  if (!result) notFound();

  return (
    <ProviderBookingDetailClient
      initialBooking={result.booking as unknown as BookingDetail}
      initialPriorBookings={
        result.priorBookings as unknown as PriorBooking[]
      }
    />
  );
}
