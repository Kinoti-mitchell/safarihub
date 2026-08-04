import Link from "next/link";

type Props = {
  supportEmail?: string;
  supportPhone?: string;
  cancellationHours?: number;
  checkInTime?: string;
  checkOutTime?: string;
};

/** Trust cues shown beside checkout — policy + support before pay. */
export function BookingTrustStrip({
  supportEmail = "support@safarihub.co.ke",
  supportPhone,
  cancellationHours = 48,
  checkInTime,
  checkOutTime,
}: Props) {
  return (
    <div className="space-y-2 rounded-md border border-line/80 bg-sand/30 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
      {checkInTime || checkOutTime ? (
        <p>
          Standard times
          {checkInTime ? ` · check-in ${checkInTime}` : ""}
          {checkOutTime ? ` · check-out ${checkOutTime}` : ""}.
        </p>
      ) : null}
      <p>
        Free cancellation until check-in
        {cancellationHours > 0
          ? ` (aim for ≥${cancellationHours}h notice)`
          : ""}
        .{" "}
        <Link
          href="/legal/cancellation"
          className="font-medium text-lake-bright underline"
        >
          Cancellation policy
        </Link>
      </p>
      <p>
        Need help?{" "}
        <a
          href={`mailto:${supportEmail}`}
          className="font-medium text-lake-bright underline"
        >
          {supportEmail}
        </a>
        {supportPhone ? (
          <>
            {" · "}
            <a
              href={`tel:${supportPhone.replace(/\s+/g, "")}`}
              className="font-medium text-lake-bright underline"
            >
              {supportPhone}
            </a>
          </>
        ) : null}
      </p>
      <p className="text-[11px] text-ink-muted/90">
        Price shown includes VAT where applicable. You receive a confirmation
        link by email after booking.
      </p>
    </div>
  );
}
