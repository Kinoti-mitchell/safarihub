"use client";

import { useEffect, useRef, useState } from "react";

type MediaItem = { id: string; url: string; alt?: string | null; isCover?: boolean };

type EventDetails = {
  title: string;
  when?: string;
  where?: string;
  price?: string;
  tagline?: string;
};

type Props = {
  listingId: string;
  /** Prefill from listing / ticket offer — no re-typing needed */
  event: EventDetails;
  media: MediaItem[];
  disabled?: boolean;
  platformName?: string;
  onChanged: () => Promise<void> | void;
  onError: (msg: string) => void;
  onMsg: (msg: string) => void;
};

const SCENES = [
  {
    id: "concert",
    label: "Concert lights",
    accent: "#f4c430",
    url: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "safari",
    label: "Safari sunset",
    accent: "#e8b86d",
    url: "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "crowd",
    label: "Festival crowd",
    accent: "#ff8fab",
    url: "https://images.unsplash.com/photo-1533174072545-7a69e10a8c2f?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "nairobi",
    label: "City night",
    accent: "#7dd3fc",
    url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "beach",
    label: "Coast vibe",
    accent: "#fde68a",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "stage",
    label: "Stage glow",
    accent: "#c084fc",
    url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
  },
] as const;

const LAYOUTS = [
  { id: "hero", label: "Photo + bold text" },
  { id: "split", label: "Split collage" },
  { id: "magazine", label: "Magazine cover" },
] as const;

function isFlyer(m: MediaItem) {
  const a = (m.alt || "").toLowerCase();
  return a === "flyer" || a === "event-flyer" || a.includes("flyer");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

function coverDraw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = img.width / img.height;
  const tr = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (ir > tr) {
    sw = img.height * tr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / tr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
  return cy;
}

/**
 * Upload an event flyer or design a photo-rich poster.
 */
export function EventFlyerTools({
  listingId,
  event,
  media,
  disabled,
  platformName = "Platform",
  onChanged,
  onError,
  onMsg,
}: Props) {
  const defaultTagline = `Tickets on ${platformName}`;
  const [busy, setBusy] = useState(false);
  const [editText, setEditText] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [when, setWhen] = useState(event.when || "");
  const [where, setWhere] = useState(event.where || "");
  const [price, setPrice] = useState(event.price || "");
  const [tagline, setTagline] = useState(event.tagline || defaultTagline);
  const [sceneId, setSceneId] = useState<(typeof SCENES)[number]["id"]>("concert");
  const [layoutId, setLayoutId] = useState<(typeof LAYOUTS)[number]["id"]>("hero");
  const [bgSource, setBgSource] = useState<"scene" | "listing" | "upload">("scene");
  const [listingPhotoId, setListingPhotoId] = useState<string>("");
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const flyers = media.filter(isFlyer);
  const photos = media.filter((m) => !isFlyer(m));

  // Keep poster text in sync with listing / offer details filled above
  useEffect(() => {
    setTitle(event.title || "");
    setWhen(event.when || "");
    setWhere(event.where || "");
    setPrice(event.price || "");
    setTagline(event.tagline || defaultTagline);
  }, [
    defaultTagline,
    event.title,
    event.when,
    event.where,
    event.price,
    event.tagline,
  ]);

  useEffect(() => {
    if (!listingPhotoId && photos[0]) setListingPhotoId(photos[0].id);
  }, [photos, listingPhotoId]);

  async function resolveBgUrl(): Promise<string> {
    if (bgSource === "upload" && customBg) return customBg;
    if (bgSource === "listing") {
      const photo = photos.find((p) => p.id === listingPhotoId) || photos[0];
      if (photo?.url) return photo.url;
    }
    const scene = SCENES.find((s) => s.id === sceneId) || SCENES[0];
    return `/api/image-proxy?url=${encodeURIComponent(scene.url)}`;
  }

  async function drawPoster() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      const w = 1080;
      const h = 1350;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const scene = SCENES.find((s) => s.id === sceneId) || SCENES[0];
      const accent = scene.accent;
      let img: HTMLImageElement | null = null;
      try {
        img = await loadImage(await resolveBgUrl());
      } catch {
        // Fallback: try listing photo without proxy
        if (photos[0]) {
          try {
            img = await loadImage(photos[0].url);
          } catch {
            img = null;
          }
        }
      }

      if (layoutId === "split" && img) {
        await drawSplit(ctx, img, w, h, accent);
      } else if (layoutId === "magazine" && img) {
        await drawMagazine(ctx, img, w, h, accent);
      } else {
        await drawHero(ctx, img, w, h, accent);
      }

      const dataUrl = canvas.toDataURL("image/png");
      setPreview(dataUrl);
      onMsg("Poster ready — save or download");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not generate poster");
    } finally {
      setBusy(false);
    }
  }

  async function drawHero(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | null,
    w: number,
    h: number,
    accent: string,
  ) {
    if (img) {
      coverDraw(ctx, img, 0, 0, w, h);
    } else {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#0b1f2a");
      g.addColorStop(1, "#163a4a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // Dark vignette + bottom fade for text
    const fade = ctx.createLinearGradient(0, h * 0.25, 0, h);
    fade.addColorStop(0, "rgba(0,0,0,0.05)");
    fade.addColorStop(0.45, "rgba(0,0,0,0.35)");
    fade.addColorStop(1, "rgba(0,0,0,0.88)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);

    // Accent bar
    ctx.fillStyle = accent;
    ctx.fillRect(64, 72, 120, 10);

    ctx.fillStyle = accent;
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.fillText("SAFARI HUB  ·  LIVE EVENT", 64, 130);

    ctx.fillStyle = "#fffaf0";
    ctx.font = "800 78px Georgia, serif";
    const titleEnd = wrapText(
      ctx,
      title.trim() || "Your event",
      64,
      280,
      w - 128,
      88,
    );

    let y = Math.max(titleEnd + 60, 520);
    ctx.font = "600 34px system-ui, sans-serif";
    if (when.trim()) {
      ctx.fillStyle = accent;
      ctx.fillText(when.trim(), 64, y);
      y += 56;
    }
    if (where.trim()) {
      ctx.fillStyle = "#f0e6d8";
      ctx.font = "400 32px system-ui, sans-serif";
      ctx.fillText(where.trim(), 64, y);
      y += 70;
    }

    if (price.trim()) {
      const label = price.trim().startsWith("KES")
        ? price.trim()
        : `KES ${price.trim()}`;
      ctx.font = "700 36px Georgia, serif";
      const tw = ctx.measureText(label).width;
      roundRect(ctx, 64, y, tw + 48, 72, 12);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.fillText(label, 88, y + 48);
      y += 110;
    }

    // Soft secondary photo inset if listing has another image
    const extra = photos.find((p) => p.id !== listingPhotoId) || photos[1];
    if (extra && bgSource !== "listing") {
      try {
        const inset = await loadImage(extra.url);
        const iw = 280;
        const ih = 280;
        const ix = w - iw - 64;
        const iy = h - ih - 180;
        ctx.save();
        ctx.beginPath();
        ctx.arc(ix + iw / 2, iy + ih / 2, iw / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        coverDraw(ctx, inset, ix, iy, iw, ih);
        ctx.restore();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(ix + iw / 2, iy + ih / 2, iw / 2, 0, Math.PI * 2);
        ctx.stroke();
      } catch {
        /* optional */
      }
    }

    ctx.fillStyle = "rgba(255,250,240,0.85)";
    ctx.font = "400 28px system-ui, sans-serif";
    wrapText(ctx, tagline.trim() || defaultTagline, 64, h - 90, w - 160, 34);
  }

  async function drawSplit(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number,
    accent: string,
  ) {
    coverDraw(ctx, img, 0, 0, w, h * 0.58);
    ctx.fillStyle = "#0c1218";
    ctx.fillRect(0, h * 0.55, w, h * 0.45);

    // Diagonal accent
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.55);
    ctx.lineTo(w, h * 0.52);
    ctx.lineTo(w, h * 0.56);
    ctx.lineTo(0, h * 0.59);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.font = "700 24px system-ui, sans-serif";
    ctx.fillText("TICKETS AVAILABLE", 64, h * 0.64);

    ctx.fillStyle = "#fffaf0";
    ctx.font = "800 68px Georgia, serif";
    wrapText(ctx, title.trim() || "Your event", 64, h * 0.72, w - 128, 76);

    let y = h * 0.88;
    ctx.font = "500 30px system-ui, sans-serif";
    ctx.fillStyle = accent;
    const bits = [when.trim(), where.trim()].filter(Boolean).join("  ·  ");
    if (bits) ctx.fillText(bits, 64, y);
    if (price.trim()) {
      ctx.fillStyle = "#fff";
      ctx.font = "700 40px Georgia, serif";
      ctx.fillText(
        price.trim().startsWith("KES") ? price.trim() : `KES ${price.trim()}`,
        64,
        y + 56,
      );
    }
  }

  async function drawMagazine(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number,
    accent: string,
  ) {
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, w, h);

    const pad = 48;
    coverDraw(ctx, img, pad, pad, w - pad * 2, h * 0.62);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(pad, pad, w - pad * 2, h * 0.62);

    // Masthead
    ctx.fillStyle = accent;
    ctx.font = "800 42px Georgia, serif";
    ctx.fillText("EVENT", pad, h * 0.72);

    ctx.fillStyle = "#fff";
    ctx.font = "800 64px Georgia, serif";
    wrapText(ctx, title.trim() || "Your event", pad, h * 0.8, w - pad * 2, 70);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "400 28px system-ui, sans-serif";
    const line = [when.trim(), where.trim(), price.trim() ? (price.trim().startsWith("KES") ? price.trim() : `KES ${price.trim()}`) : ""]
      .filter(Boolean)
      .join("  ·  ");
    wrapText(ctx, line || tagline, pad, h - 100, w - pad * 2, 34);
  }

  async function saveDataUrl(dataUrl: string, setAsCover: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl,
          alt: "flyer",
          isCover: setAsCover,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || "Could not save flyer");
        return;
      }
      onMsg(setAsCover ? "Flyer saved as thumbnail" : "Flyer saved to listing");
      await onChanged();
    } catch {
      onError("Network error saving flyer");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadFile(file: File) {
    setBusy(true);
    try {
      const body = new FormData();
      body.append("files", file, file.name);
      body.set("alt", "flyer");
      body.set(
        "setAsCover",
        flyers.length === 0 && media.length === 0 ? "true" : "false",
      );
      const res = await fetch(`/api/listings/${listingId}/media`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || "Upload failed");
        return;
      }
      onMsg("Flyer uploaded");
      await onChanged();
    } catch {
      onError("Network error uploading flyer");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onPickBgFile(file: File) {
    const url = URL.createObjectURL(file);
    setCustomBg(url);
    setBgSource("upload");
  }

  async function removeFlyer(mediaId: string) {
    if (!window.confirm("Remove this flyer from the listing?")) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/listings/${listingId}/media/${mediaId}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || "Could not remove flyer");
        return;
      }
      onMsg("Flyer removed");
      await onChanged();
    } catch {
      onError("Network error removing flyer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border border-lake/25 bg-lake/5 p-4">
      <h3 className="font-display text-lg font-semibold text-lake">
        Event flyer / poster
      </h3>
      <p className="mt-1 text-sm text-ink-muted">
        Upload a finished flyer, or build a photo poster with stock scenes or
        your listing photos.
      </p>

      {flyers.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {flyers.map((f) => (
            <div
              key={f.id}
              className="overflow-hidden border border-line bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.url}
                alt="Event flyer"
                className="aspect-[4/5] w-full object-cover"
              />
              <div className="flex items-center justify-between gap-2 p-2">
                <p className="text-xs text-ink-muted">Saved flyer</p>
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => void removeFlyer(f.id)}
                  className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUploadFile(f);
          }}
        />
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-lake px-4 py-2 text-sm font-semibold text-lake disabled:opacity-60"
        >
          {busy ? "Working…" : "Upload your flyer"}
        </button>
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <p className="text-sm font-medium text-ink">Make a photo poster</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Uses the event title, place, hours and ticket price you already
          entered — pick a photo look and generate.
        </p>

        <fieldset className="mt-3">
          <legend className="text-sm text-ink-muted">Background image</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["scene", "Stock scene"],
                ["listing", "My listing photo"],
                ["upload", "Upload photo"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setBgSource(id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  bgSource === id
                    ? "border-lake bg-lake text-sand"
                    : "border-line text-ink-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {bgSource === "scene" && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {SCENES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSceneId(s.id)}
                className={`overflow-hidden border text-left ${
                  sceneId === s.id
                    ? "border-lake ring-2 ring-lake/40"
                    : "border-line"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.url}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
                <span className="block truncate px-1 py-1 text-[10px] text-ink-muted">
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {bgSource === "listing" && (
          <div className="mt-3">
            {photos.length === 0 ? (
              <p className="text-xs text-ink-muted">
                No listing photos yet — upload some in the Photos step, or use a
                stock scene.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setListingPhotoId(p.id)}
                    className={`overflow-hidden border ${
                      listingPhotoId === p.id
                        ? "border-lake ring-2 ring-lake/40"
                        : "border-line"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {bgSource === "upload" && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              ref={bgFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickBgFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => bgFileRef.current?.click()}
              className="rounded-md border border-line px-3 py-2 text-sm"
            >
              Choose background photo
            </button>
            {customBg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={customBg}
                alt=""
                className="h-16 w-16 rounded object-cover"
              />
            )}
          </div>
        )}

        <fieldset className="mt-4">
          <legend className="text-sm text-ink-muted">Layout</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLayoutId(l.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  layoutId === l.id
                    ? "border-lake bg-lake text-sand"
                    : "border-line text-ink-muted"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 border border-line bg-white/80 px-3 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-lake">
                From your event details
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-ink">
                {title || "Untitled event"}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {[when, where, price ? (price.startsWith("KES") ? price : `KES ${price}`) : ""]
                  .filter(Boolean)
                  .join(" · ") || "Add title, hours, address or a ticket offer above — they appear here automatically."}
              </p>
              {tagline ? (
                <p className="mt-1 text-xs text-ink-muted">{tagline}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setEditText((v) => !v)}
              className="text-xs font-medium text-lake-bright underline"
            >
              {editText ? "Done" : "Tweak text"}
            </button>
          </div>
          {editText && (
            <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Date / time
                <input
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Venue
                <input
                  value={where}
                  onChange={(e) => setWhere(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Price
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Tagline
                <input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" aria-hidden />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void drawPoster()}
            className="rounded-md bg-lake px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
          >
            {busy ? "Designing…" : "Generate photo poster"}
          </button>
          {preview && (
            <>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => void saveDataUrl(preview, true)}
                className="rounded-md border border-lake px-4 py-2 text-sm font-semibold text-lake disabled:opacity-60"
              >
                Save as listing flyer
              </button>
              <a
                href={preview}
                download={`${(title || "event").replace(/\s+/g, "-").slice(0, 40)}-flyer.png`}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink-muted"
              >
                Download PNG
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPreview(null)}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink-muted"
              >
                Discard preview
              </button>
            </>
          )}
        </div>

        {preview && (
          <div className="mt-4 max-w-xs overflow-hidden border border-line bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Poster preview" className="w-full" />
            <button
              type="button"
              disabled={busy}
              onClick={() => setPreview(null)}
              className="w-full border-t border-line py-2 text-xs font-medium text-red-700"
            >
              Discard this preview
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
