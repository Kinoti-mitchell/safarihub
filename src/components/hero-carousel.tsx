"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

export type HeroSlide = {
  key: string;
  src: string;
  alt: string;
  href?: string;
  title?: string;
  place?: string;
  logoUrl?: string | null;
  intro?: string;
  amenities?: string[];
  ratingAvg?: number | null;
  ratingCount?: number;
};

export type HeroBrand = {
  name: string;
  logoUrl?: string;
  headline: string;
  subheadline?: string;
};

const BRAND_FALLBACKS: HeroSlide[] = [
  {
    key: "brand-elephants",
    src: "/hero/elephants-savanna.jpg",
    alt: "Open landscape at golden hour",
  },
  {
    key: "brand-elephant-close",
    src: "/hero/elephant-close.jpg",
    alt: "Wildlife in the wild",
  },
  {
    key: "brand-herd",
    src: "/hero/elephant-herd.jpg",
    alt: "Animals crossing a dirt road",
  },
];

const INTERVAL_MS = 7000;
const MIN_SLIDES = 3;

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function buildSlides(listingSlides: HeroSlide[]): HeroSlide[] {
  const withPhotos = listingSlides.filter((s) => s.src);
  if (withPhotos.length >= MIN_SLIDES) return withPhotos.slice(0, 6);
  const keys = new Set(withPhotos.map((s) => s.src));
  const pad = BRAND_FALLBACKS.filter((s) => !keys.has(s.src));
  return [...withPhotos, ...pad].slice(
    0,
    Math.max(MIN_SLIDES, withPhotos.length + 1),
  );
}

export function HomeHero({
  slides: listingSlides = [],
  brand,
}: {
  slides?: HeroSlide[];
  brand?: HeroBrand | null;
}) {
  const slides = buildSlides(listingSlides);
  const [index, setIndex] = useState(0);
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (reduceMotion || slides.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, slides.length]);

  const active = slides[index] ?? slides[0];
  const showListing = Boolean(active?.title);
  const meta = showListing
    ? [
        active.place,
        active.ratingAvg != null && active.ratingCount
          ? `★ ${active.ratingAvg.toFixed(1)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="absolute inset-0">
        {slides.map((slide, i) => (
          <div
            key={slide.key}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
            style={{
              backgroundImage: `url('${slide.src}')`,
              opacity: i === index ? 1 : 0,
            }}
            role="img"
            aria-label={slide.alt}
            aria-hidden={i !== index}
          />
        ))}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(105deg, rgba(12,61,58,0.88) 0%, rgba(20,32,30,0.55) 48%, rgba(12,61,58,0.35) 100%)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-end px-4 pb-14 pt-24 sm:px-6 sm:pb-16">
        {showListing ? (
          <div className="animate-fade-up max-w-2xl">
            <div className="flex items-start gap-3">
              {active.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={active.logoUrl}
                  alt=""
                  className="mt-1 size-12 shrink-0 rounded-lg bg-sand/15 object-contain p-1"
                />
              ) : null}
              <div className="min-w-0">
                {active.href ? (
                  <Link
                    href={active.href}
                    className="block font-display text-4xl font-semibold leading-[1.05] tracking-tight text-sand transition hover:text-sun-soft sm:text-5xl md:text-6xl"
                  >
                    {active.title}
                  </Link>
                ) : (
                  <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-sand sm:text-5xl md:text-6xl">
                    {active.title}
                  </h1>
                )}
                {meta && (
                  <p className="mt-2 text-sm text-sand/80 sm:text-base">{meta}</p>
                )}
              </div>
            </div>
            {active.intro ? (
              <p className="mt-4 line-clamp-3 max-w-xl text-base leading-relaxed text-sand/90">
                {active.intro}
              </p>
            ) : null}
            {active.amenities && active.amenities.length > 0 ? (
              <p className="mt-2 text-sm text-sand/70">
                {active.amenities.join(" · ")}
              </p>
            ) : null}
            {active.href ? (
              <div className="mt-6">
                <Link
                  href={active.href}
                  className="inline-flex rounded-lg bg-sun px-5 py-3 text-sm font-semibold text-ink shadow-md transition hover:-translate-y-0.5 hover:brightness-110"
                >
                  Book now
                </Link>
              </div>
            ) : null}
          </div>
        ) : brand ? (
          <div className="animate-fade-up max-w-2xl">
            <div className="flex items-start gap-3">
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logoUrl}
                  alt=""
                  className="mt-1 size-14 shrink-0 rounded-lg bg-sand/15 object-contain p-1.5"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sand/70">
                  {brand.name}
                </p>
                <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-sand sm:text-5xl md:text-6xl">
                  {brand.headline}
                </h1>
              </div>
            </div>
            {brand.subheadline ? (
              <p className="mt-4 max-w-xl text-base leading-relaxed text-sand/90 sm:text-lg">
                {brand.subheadline}
              </p>
            ) : null}
            <div className="mt-6">
              <Link
                href="/browse"
                className="inline-flex rounded-lg bg-sun px-5 py-3 text-sm font-semibold text-ink shadow-md transition hover:-translate-y-0.5 hover:brightness-110"
              >
                Browse listings
              </Link>
            </div>
          </div>
        ) : null}

        {slides.length > 1 && (
          <div className="mt-10 flex gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                aria-label={`Show slide ${i + 1}: ${slide.alt}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? "w-7 bg-sand"
                    : "w-1.5 bg-sand/45 hover:bg-sand/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** @deprecated Use HomeHero — kept for any stray imports during transition. */
export function HeroCarousel(props: { listings?: HeroSlide[] }) {
  return <HomeHero slides={props.listings} />;
}
