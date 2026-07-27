import Link from "next/link";
import { db } from "@/lib/supabase";
import { browseHref } from "@/lib/categories";

export default async function EventsPage() {
  let events: Array<{
    id: string;
    title: string;
    description: string | null;
    startsAt: string;
    venue: string | null;
    county: { name: string; slug: string } | null;
  }> = [];
  try {
    const { data, error } = await db
      .from("Event")
      .select("*, county:County(*)")
      .eq("isPublished", true)
      .order("startsAt", { ascending: true });
    if (error) throw error;
    events = (data ?? []) as typeof events;
  } catch {
    events = [];
  }

  return (
    <div>
      <div className="border-b border-line/60 bg-white/50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <h1 className="font-display text-3xl font-semibold text-lake sm:text-4xl">
            Events
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted sm:text-base">
            What&apos;s on across Kenya — then book a stay, transfer or table
            nearby in one marketplace.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {events.length > 0 ? (
          <ul className="divide-y divide-line/80 border-y border-line/80">
            {events.map((e) => {
              const when = new Date(e.startsAt);
              const stayHref = browseHref({
                category: "stays",
                county: e.county?.slug,
              });
              return (
                <li key={e.id} className="flex gap-5 py-6 sm:gap-8">
                  <time
                    dateTime={e.startsAt}
                    className="w-16 shrink-0 text-center sm:w-20"
                  >
                    <span className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      {when.toLocaleString("en-KE", { month: "short" })}
                    </span>
                    <span className="font-display mt-0.5 block text-3xl font-semibold text-lake">
                      {when.getDate()}
                    </span>
                    <span className="mt-1 block text-xs text-ink-muted">
                      {when.toLocaleString("en-KE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </time>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-xl font-semibold text-ink">
                      {e.title}
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {[e.venue, e.county?.name].filter(Boolean).join(" · ")}
                    </p>
                    {e.description && (
                      <p className="mt-3 text-sm leading-relaxed text-ink">
                        {e.description}
                      </p>
                    )}
                    <Link
                      href={stayHref}
                      className="mt-4 inline-flex text-sm font-semibold text-lake-bright transition hover:text-lake"
                    >
                      Book a stay nearby →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="border border-line/80 bg-white/60 px-6 py-12 text-center">
            <p className="font-display text-lg font-semibold text-ink">
              No events published yet
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              Explore stays and experiences while the calendar fills up.
            </p>
            <Link
              href="/browse"
              className="mt-5 inline-flex rounded-lg bg-lake px-4 py-2 text-sm font-semibold text-sand"
            >
              Browse Kenya
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
