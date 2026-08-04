"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  use,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { publicListingPath, publicProviderPath } from "@/lib/listing-paths";
import { ListingCategoryPicker } from "@/components/listing-category-picker";
import { EventFlyerTools } from "@/components/event-flyer-tools";
import {
  CATEGORY_LABELS,
  OFFER_KINDS,
  offerKindLabel,
  amenityLabel,
  normalizeCategories,
  normalizeListingKinds,
  kindsFromCategories,
  defaultOfferKindFor,
  defaultOfferKindForCategories,
  offerKindsForCategories,
  offerFormCopy,
  requiresMapLocation,
  type ListingCategoryKey,
  type ListingKindKey,
  type OfferKind,
} from "@/lib/amenities";
import {
  bulletsToTextarea,
  isTourCategories,
} from "@/lib/tour-listing";

type Busy =
  | null
  | "image"
  | "room"
  | "publish"
  | "boostRequest"
  | "availability"
  | "gps"
  | "details";

type BoostPlanOption = {
  id: string;
  period: string;
  label: string;
  priceKes: number;
};

type BoostRequestRow = {
  id: string;
  period: string;
  priceKes: number;
  status: string;
  paymentRef: string | null;
  adminNote: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

const SETUP_STEPS = [
  {
    key: "details",
    title: "Contact",
    blurb: "Description, tour details, guest phone, payments",
  },
  { key: "photos", title: "Photos", blurb: "Show guests the experience" },
  {
    key: "offers",
    title: "Offers",
    blurb: "Activities, packages, seats & departure capacity",
  },
  { key: "location", title: "Map pin", blurb: "Meeting point / GPS" },
  { key: "submit", title: "Preview", blurb: "Check everything, then publish" },
] as const;

/** First incomplete setup step — skips redoing basics already captured on create. */
function suggestSetupStep(listing: {
  media?: unknown[];
  roomTypes?: unknown[];
  latitude?: number | null;
  longitude?: number | null;
  listingKinds?: unknown;
  phone?: string | null;
  description?: string | null;
}): number {
  if (!listing.media?.length) return 1;
  if (!listing.roomTypes?.length) return 2;
  const kinds = normalizeListingKinds(listing.listingKinds);
  if (
    requiresMapLocation(kinds) &&
    (listing.latitude == null || listing.longitude == null)
  ) {
    return 3;
  }
  // Prefer preview when the heavy steps are done
  if (listing.media?.length && listing.roomTypes?.length) return 4;
  return 0;
}

export default function ProviderListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [listing, setListing] = useState<any>(null);
  const [completeness, setCompleteness] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [stepInitialized, setStepInitialized] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  const [busy, setBusy] = useState<Busy>(null);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [listingKinds, setListingKinds] = useState<ListingKindKey[]>(["PLACE"]);
  const [categories, setCategories] = useState<ListingCategoryKey[]>(["STAY"]);
  const [offerKind, setOfferKind] = useState<OfferKind>("ROOM");
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [editOfferDraft, setEditOfferDraft] = useState<{
    name: string;
    quantity: number;
    basePrice: number;
    dayUsePrice: string;
    maxGuests: number;
    offerKind: OfferKind;
  } | null>(null);
  const detailsFormRef = useRef<HTMLFormElement>(null);
  const [availByRoom, setAvailByRoom] = useState<any[]>([]);
  const [availSummary, setAvailSummary] = useState<{
    totalRooms: number;
    openToday: number;
    bookedToday: number;
    bookedRoomNights: number;
    roomTypeCount: number;
  } | null>(null);
  const [availFrom, setAvailFrom] = useState("");
  const [availTo, setAvailTo] = useState("");
  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [filterTo, setFilterTo] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [editAvailable, setEditAvailable] = useState(1);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [pendingCoverIndex, setPendingCoverIndex] = useState(0);
  const [replaceThumbnail, setReplaceThumbnail] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [boostEnabled, setBoostEnabled] = useState(false);
  const [boostPlans, setBoostPlans] = useState<BoostPlanOption[]>([]);
  const [boostInstructions, setBoostInstructions] = useState("");
  const [boostPaybill, setBoostPaybill] = useState("");
  const [boostRequests, setBoostRequests] = useState<BoostRequestRow[]>([]);
  const [boostPlanId, setBoostPlanId] = useState("");
  const [boostPaymentRef, setBoostPaymentRef] = useState("");
  const [boostPaymentNote, setBoostPaymentNote] = useState("");
  const [boostEndsAt, setBoostEndsAt] = useState<string | null>(null);
  const [boostIsPromoted, setBoostIsPromoted] = useState(false);
  const [publishFeeKes, setPublishFeeKes] = useState(0);
  const [publishInstructions, setPublishInstructions] = useState("");
  const [publishPaybill, setPublishPaybill] = useState("");
  const [publishPaymentRef, setPublishPaymentRef] = useState("");
  const [publishPaymentNote, setPublishPaymentNote] = useState("");

  async function load(opts?: { initStep?: boolean }) {
    const res = await fetch(`/api/listings/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not load listing");
      return;
    }
    setListing(data.listing);
    setCompleteness(data.completeness);
    if (data.publish) {
      setPublishFeeKes(Number(data.publish.feeKes) || 0);
      setPublishInstructions(data.publish.paymentInstructions || "");
      setPublishPaybill(data.publish.paybill || "");
    }
    if (data.listing?.publishPaymentRef) {
      setPublishPaymentRef(String(data.listing.publishPaymentRef));
    }
    setAmenities(
      Array.isArray(data.listing?.amenities) ? data.listing.amenities : [],
    );
    const kinds = normalizeListingKinds(data.listing?.listingKinds);
    setListingKinds(kinds);
    const cats = normalizeCategories(
      data.listing?.categories?.length
        ? data.listing.categories
        : data.listing?.category,
    );
    setCategories(cats);
    setOfferKind(defaultOfferKindForCategories(cats));
    setSelectedRoom((prev) => {
      if (prev && prev !== "all") {
        const stillThere = data.listing?.roomTypes?.some(
          (r: any) => r.id === prev,
        );
        if (stillThere) return prev;
      }
      return "all";
    });

    if (opts?.initStep && !stepInitialized) {
      const params = new URLSearchParams(window.location.search);
      const fromNew = params.get("from") === "new";
      const stepParam = params.get("step");
      if (stepParam != null && !Number.isNaN(Number(stepParam))) {
        setStep(
          Math.min(
            SETUP_STEPS.length - 1,
            Math.max(0, Number(stepParam)),
          ),
        );
      } else if (fromNew) {
        // Create form already collected name / category / place — go to photos
        setStep(1);
        setMsg("Listing created — now add photos, then offers");
        setError(null);
      } else {
        setStep(suggestSetupStep(data.listing));
      }
      setStepInitialized(true);
      // Clean query so refresh doesn't re-flash
      if (fromNew || stepParam != null) {
        window.history.replaceState(
          {},
          "",
          `/provider/listings/${id}`,
        );
      }
    }
  }

  useEffect(() => {
    void load({ initStep: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function registrationDate(): string {
    const raw = listing?.provider?.createdAt;
    if (!raw) return "";
    const d = new Date(raw);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  async function loadAvailability(filter: string) {
    if (!listing?.roomTypes?.length) {
      setAvailByRoom([]);
      setAvailSummary(null);
      return;
    }
    const registered = registrationDate();
    let from = filterFrom || registered;
    let to = filterTo || from;
    if (registered && from < registered) from = registered;
    if (to < from) to = from;
    setAvailFrom(registered);
    try {
      const qs = new URLSearchParams();
      qs.set("from", from);
      qs.set("to", to);
      if (filter && filter !== "all") qs.set("roomTypeId", filter);
      const res = await fetch(
        `/api/listings/${id}/availability?${qs.toString()}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load availability");
        return;
      }
      setAvailFrom(data.registeredOn || registered);
      setAvailByRoom(data.roomTypes || []);
      setAvailSummary(data.summary || null);
      if (data.from) setFilterFrom(data.from);
      if (data.to) setFilterTo(data.to);
      const open =
        data.summary?.minOpen ??
        data.summary?.openToday ??
        data.summary?.totalRooms ??
        1;
      if (filter && filter !== "all") {
        const block = data.roomTypes?.[0];
        setEditAvailable(
          block?.summary?.minOpen ??
            block?.summary?.openToday ??
            block?.room?.quantity ??
            open,
        );
      } else {
        setEditAvailable(open);
      }
    } catch {
      setError("Network error loading availability");
    }
  }

  useEffect(() => {
    if (listing?.provider?.createdAt && listing?.roomTypes?.length) {
      void loadAvailability(selectedRoom || "all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedRoom,
    filterFrom,
    filterTo,
    listing?.provider?.createdAt,
    listing?.roomTypes?.length,
  ]);

  useEffect(() => {
    const urls = pickedFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [pickedFiles]);

  function flash(ok: string) {
    setError(null);
    setMsg(ok);
  }

  function clearPickedFiles() {
    setPickedFiles([]);
    setPendingCoverIndex(0);
    setReplaceThumbnail(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function isImageFile(file: File) {
    return (
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif)$/i.test(file.name)
    );
  }

  function acceptLocalFiles(list: FileList | File[] | null | undefined) {
    if (!list || !list.length) return;
    const incoming = Array.from(list);
    const valid: File[] = [];
    for (const file of incoming) {
      if (!isImageFile(file)) {
        setError(`Skipped ${file.name} — use JPG, PNG, WebP, or GIF`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} is over 5 MB`);
        continue;
      }
      valid.push(file);
    }
    if (!valid.length) return;
    setError(null);
    setPickedFiles((prev) => {
      const next = [...prev, ...valid];
      setMsg(`${next.length} photo(s) ready to upload`);
      return next;
    });
    setImageUrl("");
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    acceptLocalFiles(e.target.files);
    // allow selecting the same files again later
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    acceptLocalFiles(e.dataTransfer.files);
  }

  function removePicked(index: number) {
    setPickedFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setPendingCoverIndex((c) => {
        if (next.length === 0) return 0;
        if (c === index) return 0;
        if (c > index) return c - 1;
        return c;
      });
      return next;
    });
  }

  async function addRoom(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const name = String(form.get("name") || "").trim();
    const basePrice = Number(form.get("basePrice"));
    const dayUseRaw = String(form.get("dayUsePrice") || "").trim();
    const dayUsePrice = dayUseRaw === "" ? null : Number(dayUseRaw);
    if (!name) {
      setError("Offer name is required");
      return;
    }
    if (Number.isNaN(basePrice) || basePrice < 0) {
      setError("Enter a valid price in KES");
      return;
    }
    if (dayUsePrice != null && (Number.isNaN(dayUsePrice) || dayUsePrice < 0)) {
      setError("Enter a valid day-use price in KES");
      return;
    }

    setBusy("room");
    setError(null);
    try {
      const res = await fetch(`/api/listings/${id}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          quantity: Number(form.get("quantity") || 1),
          basePrice,
          dayUsePrice,
          offerKind,
          maxGuests: Number(form.get("maxGuests") || 2),
          capacityUnit: form.get("capacityUnit")
            ? String(form.get("capacityUnit"))
            : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not add offer");
        return;
      }
      formEl.reset();
      flash("Offer added");
      await load();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(null);
    }
  }

  function startEditOffer(r: {
    id: string;
    name: string;
    quantity: number;
    basePrice: number;
    dayUsePrice?: number | null;
    maxGuests?: number;
    offerKind?: string;
  }) {
    setEditingOfferId(r.id);
    setEditOfferDraft({
      name: r.name,
      quantity: r.quantity,
      basePrice: r.basePrice,
      dayUsePrice:
        r.dayUsePrice != null && r.dayUsePrice !== undefined
          ? String(r.dayUsePrice)
          : "",
      maxGuests: r.maxGuests || 2,
      offerKind: (r.offerKind as OfferKind) || "ROOM",
    });
    setError(null);
  }

  function cancelEditOffer() {
    setEditingOfferId(null);
    setEditOfferDraft(null);
  }

  async function saveOfferEdit() {
    if (!editingOfferId || !editOfferDraft) return;
    const name = editOfferDraft.name.trim();
    if (name.length < 1) {
      setError("Offer name is required");
      return;
    }
    const dayRaw = editOfferDraft.dayUsePrice.trim();
    const dayUsePrice = dayRaw === "" ? null : Number(dayRaw);
    if (Number.isNaN(editOfferDraft.basePrice) || editOfferDraft.basePrice < 0) {
      setError("Enter a valid price in KES");
      return;
    }
    if (dayUsePrice != null && (Number.isNaN(dayUsePrice) || dayUsePrice < 0)) {
      setError("Enter a valid day-use price");
      return;
    }
    setBusy("room");
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${editingOfferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          quantity: editOfferDraft.quantity,
          basePrice: editOfferDraft.basePrice,
          dayUsePrice,
          maxGuests: editOfferDraft.maxGuests,
          offerKind: editOfferDraft.offerKind,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update offer");
        return;
      }
      flash("Offer updated");
      cancelEditOffer();
      await load();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(null);
    }
  }

  async function deleteOffer(offerId: string, offerName: string) {
    if (!window.confirm(`Remove offer “${offerName}” from this property?`)) {
      return;
    }
    setBusy("room");
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${offerId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not remove offer");
        return;
      }
      if (editingOfferId === offerId) cancelEditOffer();
      flash("Offer removed");
      await load();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(null);
    }
  }

  async function addImage(e?: FormEvent) {
    e?.preventDefault();
    const url = imageUrl.trim();
    if (!pickedFiles.length && !url) {
      setError("Choose photos from your laptop, then click Upload photos");
      return;
    }

    setBusy("image");
    setError(null);
    setMsg(null);

    try {
      let res: Response;
      if (pickedFiles.length) {
        const body = new FormData();
        for (const file of pickedFiles) {
          body.append("files", file, file.name);
        }
        body.set(
          "coverIndex",
          String(
            Math.min(
              Math.max(0, pendingCoverIndex),
              pickedFiles.length - 1,
            ),
          ),
        );
        // First batch always sets thumbnail; later only if user opts in
        if (!listing?.media?.length || replaceThumbnail) {
          body.set("setAsCover", "true");
        }
        res = await fetch(`/api/listings/${id}/media`, {
          method: "POST",
          body,
        });
      } else {
        const normalized =
          url.startsWith("http://") || url.startsWith("https://")
            ? url
            : `https://${url}`;
        res = await fetch(`/api/listings/${id}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: normalized,
            isCover: !listing?.media?.length,
          }),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not add image");
        return;
      }
      const count = data.count || pickedFiles.length || 1;
      clearPickedFiles();
      setImageUrl("");
      flash(
        pickedFiles.length
          ? `Uploaded ${count} photo(s)`
          : "Image added from URL",
      );
      await load();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(null);
    }
  }

  async function setAsThumbnail(mediaId: string) {
    setBusy("image");
    setError(null);
    try {
      const res = await fetch(`/api/listings/${id}/media/${mediaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCover: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not set thumbnail");
        return;
      }
      flash("Thumbnail updated — this photo shows in search results");
      await load();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(null);
    }
  }

  async function removeMedia(mediaId: string) {
    if (!window.confirm("Remove this photo?")) return;
    setBusy("image");
    setError(null);
    try {
      const res = await fetch(`/api/listings/${id}/media/${mediaId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not remove photo");
        return;
      }
      flash("Photo removed");
      await load();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(null);
    }
  }

  async function saveDetails(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title =
      String(form.get("titleEdit") || form.get("title") || "").trim() ||
      String(listing?.title || "").trim();
    if (title.length < 3) {
      setError("Title must be at least 3 characters");
      return;
    }
    setBusy("details");
    setError(null);
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          listingKinds: kindsFromCategories(categories),
          categories,
          venueTypes: [],
          address: String(form.get("address") || ""),
          description: String(form.get("description") || ""),
          acceptMpesa: form.get("acceptMpesa") === "on",
          acceptCard: form.get("acceptCard") === "on",
          acceptCashOnArrival: form.get("acceptCashOnArrival") === "on",
          allowOvernight: categories.includes("STAY")
            ? form.get("allowOvernight") === "on"
            : false,
          allowDayUse: categories.includes("STAY")
            ? form.get("allowDayUse") === "on"
            : false,
          amenities,
          phone: String(form.get("phone") || "").trim() || null,
          website: String(form.get("website") || "").trim() || null,
          menuUrl: String(form.get("menuUrl") || "").trim() || null,
          openingHours: String(form.get("openingHours") || "").trim() || null,
          durationDays: form.get("durationDays")
            ? Math.round(Number(form.get("durationDays")))
            : null,
          durationHours: form.get("durationHours")
            ? Math.round(Number(form.get("durationHours")))
            : null,
          meetingPoint: String(form.get("meetingPoint") || "").trim() || null,
          inclusions: String(form.get("inclusions") || ""),
          exclusions: String(form.get("exclusions") || ""),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save details");
        return;
      }
      flash("Saved — continue to the next step");
      await load();
      setStep((s) => Math.max(s, 1));
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(null);
    }
  }

  function goBack() {
    setError(null);
    setMsg(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function goNext() {
    setError(null);
    setMsg(null);
    if (step === 0) {
      detailsFormRef.current?.requestSubmit();
      return;
    }
    if (step === 1 && !(listing?.media?.length > 0)) {
      setError("Add at least one photo before continuing");
      return;
    }
    if (step === 2 && !(listing?.roomTypes?.length > 0)) {
      setError("Add at least one offer before continuing");
      return;
    }
    setStep((s) => Math.min(SETUP_STEPS.length - 1, s + 1));
  }

  async function submitPublish() {
    if (publishFeeKes > 0 && publishPaymentRef.trim().length < 4) {
      setError("Enter your M-Pesa confirmation code after paying the publish fee");
      return;
    }
    setBusy("publish");
    setError(null);
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PENDING_REVIEW",
          paymentRef:
            publishFeeKes > 0 ? publishPaymentRef.trim() : undefined,
          paymentNote:
            publishFeeKes > 0
              ? publishPaymentNote.trim() || undefined
              : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not publish listing");
        return;
      }
      const nextStatus = data.listing?.status;
      flash(
        nextStatus === "PUBLISHED"
          ? "Your listing is live"
          : "Payment submitted — your listing goes live after payment is verified",
      );
      await load();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(null);
    }
  }

  async function loadBoost() {
    try {
      const [plansRes, reqRes] = await Promise.all([
        fetch("/api/boost/plans"),
        fetch(`/api/listings/${id}/boost`),
      ]);
      const plansBody = await plansRes.json().catch(() => ({}));
      const reqBody = await reqRes.json().catch(() => ({}));
      if (plansRes.ok) {
        setBoostEnabled(Boolean(plansBody.enabled));
        setBoostPlans(plansBody.plans || []);
        setBoostInstructions(plansBody.paymentInstructions || "");
        setBoostPaybill(plansBody.paybill || "");
        if (plansBody.plans?.[0]?.id && !boostPlanId) {
          setBoostPlanId(plansBody.plans[0].id);
        }
      }
      if (reqRes.ok) {
        setBoostRequests(reqBody.requests || []);
        setBoostEndsAt(reqBody.listing?.boostEndsAt ?? null);
        setBoostIsPromoted(Boolean(reqBody.listing?.isPromoted));
      }
    } catch {
      // non-blocking
    }
  }

  useEffect(() => {
    if (listing?.status === "PUBLISHED") {
      void loadBoost();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.status, id]);

  async function submitBoostRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!boostPlanId) {
      setError("Choose a boost period");
      return;
    }
    if (boostPaymentRef.trim().length < 4) {
      setError("Enter your M-Pesa / payment confirmation code");
      return;
    }
    setBusy("boostRequest");
    setError(null);
    try {
      const res = await fetch(`/api/listings/${id}/boost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: boostPlanId,
          paymentRef: boostPaymentRef.trim(),
          paymentNote: boostPaymentNote.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not submit boost request");
        return;
      }
      setBoostPaymentRef("");
      setBoostPaymentNote("");
      flash(
        "Boost request sent — an admin will activate it after verifying payment",
      );
      await loadBoost();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(null);
    }
  }

  async function setAvailability(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedRoom || selectedRoom === "all") {
      setError("Select a specific offer before saving departure capacity");
      return;
    }
    const form = new FormData(e.currentTarget);
    const from = filterFrom || availFrom;
    if (!from) {
      setError("Pick a from date for this departure window");
      return;
    }
    const to = (filterTo || from).trim() || from;

    const room = listing?.roomTypes?.find((r: any) => r.id === selectedRoom);
    const available = Number(form.get("available") ?? editAvailable);
    if (Number.isNaN(available) || available < 0) {
      setError("Enter a valid open capacity");
      return;
    }
    if (room && available > room.quantity) {
      setError(
        `Cannot exceed default capacity (${room.quantity} ${room.capacityUnit || "slots"})`,
      );
      return;
    }

    setBusy("availability");
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${selectedRoom}/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          available,
          price: form.get("price") ? Number(form.get("price")) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save availability");
        return;
      }
      flash(
        to
          ? `Updated capacity from ${from} to ${to}`
          : `Updated capacity for ${from}`,
      );
      await loadAvailability(selectedRoom);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(null);
    }
  }

  function updateGps() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser");
      return;
    }
    setBusy("gps");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/listings/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              locationConfirmed: true,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error || "Could not update location");
            return;
          }
          flash("Location updated from your GPS");
          await load();
        } catch {
          setError("Network error — is the server running?");
        } finally {
          setBusy(null);
        }
      },
      (err) => {
        setBusy(null);
        setError(err.message || "Could not get GPS — allow location access");
      },
    );
  }

  if (!listing && !error) {
    return <p className="p-8 text-ink-muted">Loading…</p>;
  }
  if (error && !listing) {
    return <p className="p-8 text-red-700">{error}</p>;
  }

  const checks = completeness?.checks;
  const disabled = busy !== null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/provider/listings" className="text-sm text-lake-bright underline">
        ← Listings
      </Link>
      <h1 className="font-display mt-4 text-3xl font-semibold text-lake">
        Set up listing
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {listing.title} · {listing.status}
        {listing.provider?.name ? ` · ${listing.provider.name}` : ""}
      </p>

      <nav className="mt-8" aria-label="Setup steps">
        <ol className="flex flex-wrap gap-2">
          {SETUP_STEPS.map((s, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMsg(null);
                    setStep(i);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-lake bg-lake text-sand"
                      : done
                        ? "border-lake/40 bg-lake/10 text-lake"
                        : "border-line text-ink-muted"
                  }`}
                >
                  {i + 1}. {s.title}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm text-ink-muted">
          Step {step + 1} of {SETUP_STEPS.length} — {SETUP_STEPS[step].blurb}
        </p>
      </nav>

      {msg && <p className="mt-4 text-sm text-lake-bright">{msg}</p>}
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      {listing.status === "PUBLISHED" && (
        <section className="mt-8 rounded-lg border border-line bg-sand/50 p-5">
          <h2 className="font-display text-xl text-lake">Boost this listing</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Paid promotion ranks you higher in catalogs with a Featured badge.
            Available only after admin approval of the listing.
          </p>
          {boostIsPromoted && boostEndsAt && (
            <p className="mt-3 rounded-md bg-lake/10 px-3 py-2 text-sm text-lake">
              Boost is live until{" "}
              {new Date(boostEndsAt).toLocaleString("en-KE")}
            </p>
          )}
          {boostEnabled ? (
            <form
              onSubmit={(e) => void submitBoostRequest(e)}
              className="mt-4 space-y-3"
            >
              {boostInstructions && (
                <p className="text-xs text-ink-muted whitespace-pre-wrap">
                  {boostInstructions}
                  {boostPaybill ? `\nPaybill / till: ${boostPaybill}` : ""}
                </p>
              )}
              <label className="block text-xs font-medium text-ink-muted">
                Period
                <select
                  value={boostPlanId}
                  onChange={(e) => setBoostPlanId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
                  required
                >
                  {boostPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — KES {p.priceKes.toLocaleString("en-KE")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-ink-muted">
                M-Pesa / payment reference
                <input
                  value={boostPaymentRef}
                  onChange={(e) => setBoostPaymentRef(e.target.value)}
                  placeholder="e.g. QH7X…"
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
                  required
                  minLength={4}
                />
              </label>
              <label className="block text-xs font-medium text-ink-muted">
                Note (optional)
                <input
                  value={boostPaymentNote}
                  onChange={(e) => setBoostPaymentNote(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
                />
              </label>
              <button
                type="submit"
                disabled={
                  disabled ||
                  busy === "boostRequest" ||
                  boostRequests.some((r) => r.status === "PENDING_APPROVAL")
                }
                className="rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
              >
                {busy === "boostRequest"
                  ? "Submitting…"
                  : boostRequests.some((r) => r.status === "PENDING_APPROVAL")
                    ? "Awaiting admin approval"
                    : "Request boost"}
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">
              Paid boosts are temporarily unavailable.
            </p>
          )}
          {boostRequests.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-line pt-3">
              {boostRequests.slice(0, 5).map((r) => (
                <li key={r.id} className="text-xs text-ink-muted">
                  <span className="font-semibold text-ink">
                    {r.period.toLowerCase()}
                  </span>{" "}
                  · KES {r.priceKes.toLocaleString("en-KE")} ·{" "}
                  {r.status.replace(/_/g, " ").toLowerCase()}
                  {r.endsAt
                    ? ` · until ${new Date(r.endsAt).toLocaleDateString("en-KE")}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step === 0 && (
      <section className="mt-6 border border-line bg-white/70 p-5">
        <h2 className="font-display text-xl">Contact &amp; guest details</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Name, category and place were already saved. Add guest-facing contact
          and payment options here — or skip ahead to Photos.
        </p>
        <div className="mt-3 rounded-lg border border-line/80 bg-sand/40 px-3 py-2 text-sm text-ink">
          <p className="font-medium">{listing.title}</p>
          <p className="text-xs text-ink-muted">
            {(Array.isArray(listing.categories) && listing.categories.length
              ? listing.categories
              : [listing.category]
            )
              .map((c: string) =>
                CATEGORY_LABELS[c as ListingCategoryKey]?.split(" (")[0] || c,
              )
              .join(" · ")}
            {listing.county?.name ? ` · ${listing.county.name}` : ""}
            {listing.town?.name ? `, ${listing.town.name}` : ""}
          </p>
        </div>
        <form
          ref={detailsFormRef}
          onSubmit={saveDetails}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="title" value={listing.title || ""} />
          <details className="sm:col-span-2 rounded-md border border-line bg-white/50 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              Edit name, categories or amenities
            </summary>
            <div className="mt-3 grid gap-3">
              <label className="block text-sm">
                Title
                <input
                  name="titleEdit"
                  defaultValue={listing.title}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <ListingCategoryPicker
                categories={categories}
                amenities={amenities}
                onAmenitiesChange={setAmenities}
                onCategoriesChange={(next) => {
                  setCategories(next);
                  const kinds = kindsFromCategories(next);
                  setListingKinds(kinds);
                  const allowed = offerKindsForCategories(next);
                  setOfferKind(
                    allowed.includes(offerKind)
                      ? offerKind
                      : defaultOfferKindForCategories(next),
                  );
                }}
              />
              <label className="block text-sm">
                Address / landmark
                <input
                  name="address"
                  defaultValue={listing.address || ""}
                  placeholder="Street / landmark"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
            </div>
          </details>
          <label className="block text-sm sm:col-span-2">
            {isTourCategories(categories) ? "About this tour" : "About this place"}
            <textarea
              name="description"
              rows={4}
              defaultValue={listing.description || ""}
              placeholder={
                isTourCategories(categories)
                  ? "What guests experience — parks, wildlife, pace, group size…"
                  : "Tell guests what this place is for — hotel, restaurant, pool day, cinema, venue…"
              }
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          {isTourCategories(categories) && (
            <>
              <label className="block text-sm">
                Duration (days)
                <input
                  name="durationDays"
                  type="number"
                  min={0}
                  max={90}
                  defaultValue={listing.durationDays ?? ""}
                  placeholder="e.g. 1"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Duration (hours)
                <input
                  name="durationHours"
                  type="number"
                  min={0}
                  max={72}
                  defaultValue={listing.durationHours ?? ""}
                  placeholder="e.g. 8 for a day trip"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                Meeting point
                <input
                  name="meetingPoint"
                  defaultValue={listing.meetingPoint || ""}
                  placeholder="e.g. Hotel lobby / Wilson Airport gate 2, 06:30"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Inclusions (one per line)
                <textarea
                  name="inclusions"
                  rows={3}
                  defaultValue={bulletsToTextarea(listing.inclusions)}
                  placeholder="Park fees&#10;Guide&#10;Bottled water"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Exclusions (one per line)
                <textarea
                  name="exclusions"
                  rows={3}
                  defaultValue={bulletsToTextarea(listing.exclusions)}
                  placeholder="Tips&#10;Personal items"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>
            </>
          )}
          <label className="block text-sm">
            Phone (guests can call)
            <input
              name="phone"
              type="tel"
              defaultValue={listing.phone || ""}
              placeholder="e.g. 0712 345 678"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Website
            <input
              name="website"
              type="url"
              defaultValue={listing.website || ""}
              placeholder="https://yourhotel.co.ke"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Menu link (restaurants / bars)
            <input
              name="menuUrl"
              type="url"
              defaultValue={listing.menuUrl || ""}
              placeholder="https://… PDF, Google Drive, or webpage"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Opening hours
            <input
              name="openingHours"
              defaultValue={listing.openingHours || ""}
              placeholder="Mon–Sun 10:00–22:00"
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm text-ink-muted">
              Payment methods accepted
            </legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="acceptMpesa"
                  defaultChecked={listing.acceptMpesa ?? true}
                />
                M-Pesa
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="acceptCard"
                  defaultChecked={listing.acceptCard ?? true}
                />
                Card
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="acceptCashOnArrival"
                  defaultChecked={listing.acceptCashOnArrival ?? true}
                />
                Cash on arrival
              </label>
            </div>
          </fieldset>
          {categories.includes("STAY") && (
          <fieldset className="sm:col-span-2">
            <legend className="text-sm text-ink-muted">Stay options</legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="allowOvernight"
                  defaultChecked={listing.allowOvernight ?? true}
                />
                Overnight stays
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="allowDayUse"
                  defaultChecked={listing.allowDayUse ?? true}
                />
                Daytime / day-use (same day)
              </label>
            </div>
          </fieldset>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={disabled}
              className="rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
            >
              {busy === "details" ? "Saving…" : "Save & continue →"}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setError(null);
                setMsg(null);
                setStep(1);
              }}
              className="rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink-muted"
            >
              Skip to photos →
            </button>
          </div>
        </form>
      </section>
      )}

      {step === 3 && (
      <section className="mt-6 border border-line bg-white/70 p-5">
          <h2 className="font-display text-xl">Location</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {requiresMapLocation(listingKinds)
              ? listing.locationConfirmed
                ? "Provider confirmed they are at this GPS pin"
                : "Required for places/venues — confirm the pin guests will visit"
              : "Optional for tours, events, and packages — add a meeting point or office if useful"}
          </p>
          {listing.latitude != null && listing.longitude != null ? (
            <>
          <iframe
            title="Map"
            className="mt-3 h-56 w-full border border-line"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.longitude - 0.06}%2C${listing.latitude - 0.06}%2C${listing.longitude + 0.06}%2C${listing.latitude + 0.06}&layer=mapnik&marker=${listing.latitude}%2C${listing.longitude}`}
          />
          <button
            type="button"
            disabled={disabled}
            className="mt-3 rounded-md border border-lake px-3 py-2 text-sm text-lake disabled:opacity-60"
            onClick={updateGps}
          >
            {busy === "gps" ? "Getting GPS…" : "I am here — update pin with my GPS"}
          </button>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">
              No map pin yet — set county/town when creating the listing, or use
              GPS below if your browser allows it.
            </p>
          )}
          {!(listing.latitude != null && listing.longitude != null) && (
            <button
              type="button"
              disabled={disabled}
              className="mt-3 rounded-md border border-lake px-3 py-2 text-sm text-lake disabled:opacity-60"
              onClick={updateGps}
            >
              {busy === "gps" ? "Getting GPS…" : "Set pin with my GPS"}
            </button>
          )}
      </section>
      )}

      {step === 1 && (
      <section className="mt-6 border border-line bg-white/70 p-5">
        <h2 className="font-display text-xl">Photos</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Add as many photos as you like, then choose which one is the
          thumbnail (shown in search and catalogs).
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listing.media?.map((m: any) => (
            <div
              key={m.id}
              className={`overflow-hidden border ${
                m.isCover ? "border-lake ring-2 ring-lake/30" : "border-line"
              } bg-white`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.url}
                alt={m.alt || ""}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex flex-wrap items-center gap-2 p-2 text-xs">
                {m.isCover ? (
                  <span className="font-semibold text-lake">Thumbnail</span>
                ) : (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void setAsThumbnail(m.id)}
                    className="rounded border border-lake px-2 py-1 font-medium text-lake disabled:opacity-60"
                  >
                    Set as thumbnail
                  </button>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void removeMedia(m.id)}
                  className="ml-auto text-ink-muted underline disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {!listing.media?.length && (
            <p className="text-sm text-ink-muted sm:col-span-2">
              No photos yet — upload from your laptop below.
            </p>
          )}
        </div>

        <div
          className="mt-6 rounded-md border border-dashed border-line bg-sand/40 p-4"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            id={`listing-photo-${id}`}
            type="file"
            multiple
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
            className="absolute h-px w-px overflow-hidden opacity-0"
            style={{ clip: "rect(0 0 0 0)" }}
            onChange={onFileChange}
          />

          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor={`listing-photo-${id}`}
              className={`inline-flex cursor-pointer rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand ${
                disabled ? "pointer-events-none opacity-60" : ""
              }`}
            >
              Choose photos from laptop
            </label>
            {pickedFiles.length > 0 ? (
              <button
                type="button"
                onClick={clearPickedFiles}
                className="text-sm text-ink-muted underline"
              >
                Clear selection
              </button>
            ) : (
              <span className="text-sm text-ink-muted">
                Select multiple files, or drag them here
              </span>
            )}
          </div>

          {pickedFiles.length > 0 && (
            <>
              <p className="mt-4 text-sm font-medium">
                {pickedFiles.length} selected
                {!listing.media?.length
                  ? " — click one to use as the hotel thumbnail"
                  : ""}
              </p>
              {!!listing.media?.length && (
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={replaceThumbnail}
                    onChange={(e) => setReplaceThumbnail(e.target.checked)}
                  />
                  Use the selected photo as the new thumbnail
                </label>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pickedFiles.map((file, index) => (
                  <button
                    key={`${file.name}-${index}`}
                    type="button"
                    onClick={() => setPendingCoverIndex(index)}
                    className={`overflow-hidden border text-left ${
                      pendingCoverIndex === index
                        ? "border-lake ring-2 ring-lake/30"
                        : "border-line"
                    }`}
                  >
                    {previewUrls[index] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrls[index]}
                        alt={file.name}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    )}
                    <div className="flex items-center gap-2 p-2 text-xs">
                      <span className="truncate font-medium">{file.name}</span>
                      {pendingCoverIndex === index && (
                        <span className="shrink-0 text-lake">Thumbnail</span>
                      )}
                      <span
                        role="button"
                        tabIndex={0}
                        className="ml-auto shrink-0 underline text-ink-muted"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          removePicked(index);
                        }}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") {
                            ev.stopPropagation();
                            removePicked(index);
                          }
                        }}
                      >
                        Remove
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled || !pickedFiles.length}
              onClick={() => void addImage()}
              className="rounded-md border border-lake px-4 py-2 text-sm font-semibold text-lake disabled:opacity-60"
            >
              {busy === "image"
                ? "Uploading…"
                : `Upload ${pickedFiles.length || ""} photo${pickedFiles.length === 1 ? "" : "s"}`.trim()}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4">
          <p className="text-sm text-ink-muted">Or paste an image link</p>
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              if (e.target.value) clearPickedFiles();
            }}
            placeholder="https://example.com/photo.jpg"
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={disabled || !imageUrl.trim()}
            onClick={() => void addImage()}
            className="rounded-md bg-lake px-3 py-2 text-sm text-sand disabled:opacity-60"
          >
            {busy === "image" ? "Adding…" : "Add from URL"}
          </button>
        </div>
      </section>
      )}

      {step === 2 && (
      <section className="mt-6 border border-line bg-white/70 p-5">
        <h2 className="font-display text-xl">What guests can book</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Add every bookable thing at this property — rooms, tables, day
          passes, tickets. Types follow your categories
          {categories.length
            ? ` (${categories
                .map((c) => CATEGORY_LABELS[c]?.split(" (")[0] || c)
                .join(", ")})`
            : ""}
          .
        </p>
        <ul className="mt-3 space-y-3 text-sm">
          {listing.roomTypes?.map((r: any) => (
            <li key={r.id} className="border border-line bg-white/80 p-3">
              {editingOfferId === r.id && editOfferDraft ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-sm sm:col-span-2">
                    Name
                    <input
                      value={editOfferDraft.name}
                      onChange={(e) =>
                        setEditOfferDraft({
                          ...editOfferDraft,
                          name: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-line px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    Type
                    <select
                      value={editOfferDraft.offerKind}
                      onChange={(e) =>
                        setEditOfferDraft({
                          ...editOfferDraft,
                          offerKind: e.target.value as OfferKind,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-line px-3 py-2"
                    >
                      {OFFER_KINDS.filter((k) =>
                        offerKindsForCategories(categories).includes(k.key),
                      ).map((k) => (
                        <option key={k.key} value={k.key}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Quantity
                    <input
                      type="number"
                      min={1}
                      value={editOfferDraft.quantity}
                      onChange={(e) =>
                        setEditOfferDraft({
                          ...editOfferDraft,
                          quantity: Number(e.target.value) || 1,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-line px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    Guests
                    <input
                      type="number"
                      min={1}
                      value={editOfferDraft.maxGuests}
                      onChange={(e) =>
                        setEditOfferDraft({
                          ...editOfferDraft,
                          maxGuests: Number(e.target.value) || 1,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-line px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    Price (KES)
                    <input
                      type="number"
                      min={0}
                      value={editOfferDraft.basePrice}
                      onChange={(e) =>
                        setEditOfferDraft({
                          ...editOfferDraft,
                          basePrice: Number(e.target.value) || 0,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-line px-3 py-2"
                    />
                  </label>
                  {(editOfferDraft.offerKind === "ROOM" ||
                    categories.includes("STAY")) && (
                    <label className="block text-sm">
                      Day-use (optional)
                      <input
                        type="number"
                        min={0}
                        value={editOfferDraft.dayUsePrice}
                        onChange={(e) =>
                          setEditOfferDraft({
                            ...editOfferDraft,
                            dayUsePrice: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-md border border-line px-3 py-2"
                      />
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void saveOfferEdit()}
                      className="rounded-md bg-lake px-3 py-2 text-sm font-semibold text-sand disabled:opacity-60"
                    >
                      {busy === "room" ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={cancelEditOffer}
                      className="rounded-md border border-line px-3 py-2 text-sm text-ink-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="font-medium">{r.name}</span>
                    <span className="text-ink-muted">
                      {" "}
                      · {offerKindLabel(r.offerKind)} · qty {r.quantity} · from
                      KES {r.basePrice.toLocaleString()}
                      {r.dayUsePrice != null
                        ? ` · day-use KES ${Number(r.dayUsePrice).toLocaleString()}`
                        : ""}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => startEditOffer(r)}
                      className="rounded border border-line px-2 py-1 text-xs font-medium text-lake"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void deleteOffer(r.id, r.name)}
                      className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {!listing.roomTypes?.length && (
            <li className="text-ink-muted">No offers yet — add one below.</li>
          )}
        </ul>
        <p className="mt-4 text-sm font-medium text-ink">Add another offer</p>
        {(() => {
          const allowedKinds = offerKindsForCategories(categories);
          const kind = (
            allowedKinds.includes(offerKind)
              ? offerKind
              : defaultOfferKindForCategories(categories)
          ) as OfferKind;
          const copy = offerFormCopy(kind);
          const catNames = categories
            .map((c) => CATEGORY_LABELS[c]?.split(" (")[0] || c)
            .join(", ");
          return (
            <form
              onSubmit={addRoom}
              className="mt-5 grid gap-3 sm:grid-cols-2"
            >
              <div className="sm:col-span-2">
                {allowedKinds.length <= 1 ? (
                  <>
                    <p className="text-sm font-medium text-ink">Offer type</p>
                    <p className="mt-1 rounded-md border border-line bg-sand/40 px-3 py-2 text-sm">
                      {OFFER_KINDS.find((k) => k.key === kind)?.label || kind}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Set by your category ({catNames || "Stay"}).{" "}
                      {OFFER_KINDS.find((k) => k.key === kind)?.hint}
                    </p>
                    <input type="hidden" name="offerKind" value={kind} />
                  </>
                ) : (
                  <label className="block text-sm">
                    Offer type{" "}
                    <span className="font-normal text-ink-muted">
                      (from {catNames || "your categories"})
                    </span>
                    <select
                      value={kind}
                      onChange={(e) =>
                        setOfferKind(e.target.value as OfferKind)
                      }
                      className="mt-1 w-full rounded-md border border-line px-3 py-2"
                    >
                      {OFFER_KINDS.filter((k) =>
                        allowedKinds.includes(k.key),
                      ).map((k) => (
                        <option key={k.key} value={k.key}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-ink-muted">
                      {OFFER_KINDS.find((k) => k.key === kind)?.hint}
                    </span>
                  </label>
                )}
              </div>

              <label className="block text-sm sm:col-span-2">
                {copy.nameLabel}
                <input
                  name="name"
                  required
                  placeholder={copy.namePlaceholder}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                {copy.qtyLabel}
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  defaultValue={1}
                  required
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
                <span className="mt-1 block text-xs text-ink-muted">
                  {copy.qtyHint}
                </span>
              </label>

              <label className="block text-sm">
                Guests per booking
                <input
                  name="maxGuests"
                  type="number"
                  min={1}
                  defaultValue={
                    kind === "TABLE" ? 4 : kind === "ROOM" ? 2 : 1
                  }
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
                <span className="mt-1 block text-xs text-ink-muted">
                  Max people this offer covers
                </span>
              </label>

              <label className="block text-sm">
                {copy.priceLabel}
                <input
                  name="basePrice"
                  type="number"
                  min={0}
                  required
                  className="mt-1 w-full rounded-md border border-line px-3 py-2"
                />
                {copy.priceHint ? (
                  <span className="mt-1 block text-xs text-ink-muted">
                    {copy.priceHint}
                  </span>
                ) : null}
              </label>

              {copy.showDayUse ? (
                <label className="block text-sm">
                  {copy.dayUseLabel}
                  <input
                    name="dayUsePrice"
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-md border border-line px-3 py-2"
                  />
                  <span className="mt-1 block text-xs text-ink-muted">
                    {copy.dayUseHint}
                  </span>
                </label>
              ) : (
                <input type="hidden" name="dayUsePrice" value="" />
              )}

              {(kind === "ACTIVITY" || kind === "PACKAGE") && (
                <label className="block text-sm">
                  Capacity unit
                  <select
                    name="capacityUnit"
                    defaultValue={kind === "PACKAGE" ? "packages" : "seats"}
                    className="mt-1 w-full rounded-md border border-line px-3 py-2"
                  >
                    <option value="seats">Seats</option>
                    <option value="vehicles">Vehicles</option>
                    <option value="slots">Slots</option>
                    <option value="packages">Packages</option>
                  </select>
                </label>
              )}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={disabled}
                  className="rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
                >
                  {busy === "room" ? "Adding…" : copy.submitLabel}
                </button>
              </div>
            </form>
          );
        })()}

        {listing.roomTypes?.some(
          (r: { offerKind?: string }) =>
            r.offerKind === "ACTIVITY" ||
            r.offerKind === "PACKAGE" ||
            r.offerKind === "TICKET",
        ) && (
          <div className="mt-8 rounded-lg border border-line bg-sand/30 p-4">
            <h3 className="font-display text-lg font-semibold text-lake">
              Departures &amp; capacity
            </h3>
            <p className="mt-1 text-sm text-ink-muted">
              Set how many seats or vehicles are open on a date. Default capacity
              comes from each offer&apos;s quantity; overrides apply per day.
            </p>
            <form
              onSubmit={(e) => void setAvailability(e)}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <label className="block text-sm sm:col-span-2">
                Offer
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
                >
                  <option value="all">Select an offer…</option>
                  {(listing.roomTypes || []).map(
                    (r: {
                      id: string;
                      name: string;
                      quantity: number;
                      capacityUnit?: string | null;
                      offerKind?: string;
                    }) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (default {r.quantity}{" "}
                        {r.capacityUnit || "slots"})
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="block text-sm">
                From date
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                To date
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Open capacity
                <input
                  name="available"
                  type="number"
                  min={0}
                  value={editAvailable}
                  onChange={(e) =>
                    setEditAvailable(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={disabled || busy === "availability"}
                  className="rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
                >
                  {busy === "availability" ? "Saving…" : "Save capacity"}
                </button>
              </div>
            </form>
            {availSummary && (
              <p className="mt-3 text-xs text-ink-muted">
                Today: {availSummary.openToday} open ·{" "}
                {availSummary.bookedToday} booked across{" "}
                {availSummary.roomTypeCount} offer
                {availSummary.roomTypeCount === 1 ? "" : "s"}
              </p>
            )}
            {!!availByRoom.length && (
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs text-ink-muted">
                {availByRoom.map((block: any) => (
                  <li key={block.room?.id || Math.random()}>
                    <p className="font-medium text-ink">
                      {block.room?.name || "Offer"}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {(block.days || []).slice(0, 10).map((d: any) => (
                        <li key={d.date}>
                          {d.date}: {d.available} open
                          {d.booked != null ? ` · ${d.booked} booked` : ""}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {(() => {
          const isEventOffer =
            offerKind === "TICKET" ||
            (Array.isArray(listing.roomTypes) &&
              listing.roomTypes.some(
                (r: { offerKind?: string }) => r.offerKind === "TICKET",
              ));
          if (!isEventOffer) return null;
          const ticket =
            listing.roomTypes?.find(
              (r: { offerKind?: string }) => r.offerKind === "TICKET",
            ) || listing.roomTypes?.[0];
          const place = [
            listing.address,
            listing.town?.name,
            listing.county?.name,
          ]
            .filter(Boolean)
            .join(", ");
          const priceNum =
            ticket?.basePrice != null ? Number(ticket.basePrice) : null;
          return (
            <EventFlyerTools
              listingId={id}
              event={{
                title:
                  (ticket?.name && String(ticket.name).trim()) ||
                  listing.title ||
                  "",
                when: listing.openingHours || "",
                where: place || "Kenya",
                price:
                  priceNum != null && !Number.isNaN(priceNum)
                    ? `KES ${priceNum.toLocaleString()}`
                    : "",
                tagline:
                  (listing.description &&
                    String(listing.description).trim().slice(0, 80)) ||
                  "Tickets on Safari Hub",
              }}
              media={listing.media || []}
              disabled={disabled}
              onChanged={load}
              onError={(m) => setError(m)}
              onMsg={(m) => flash(m)}
            />
          );
        })()}
      </section>
      )}

      {step === 4 && (
      <section className="mt-6 border border-line bg-white/70 p-5">
        <h2 className="font-display text-xl">Preview &amp; submit</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Review everything below. Tap Edit to change a section, then submit
          for admin approval.
        </p>

        <div className="mt-6 space-y-4">
          {/* About */}
          <div className="border border-line bg-white/90 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-lake">1. About</h3>
              <button
                type="button"
                onClick={() => setStep(0)}
                className="text-xs font-medium text-lake-bright underline"
              >
                Edit
              </button>
            </div>
            <p className="mt-2 font-display text-xl font-semibold text-ink">
              {listing.title}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {(Array.isArray(listing.categories) && listing.categories.length
                ? listing.categories
                : [listing.category]
              )
                .map(
                  (c: string) =>
                    CATEGORY_LABELS[c]?.split(" (")[0] || c,
                )
                .join(" · ")}
            </p>
            {Array.isArray(listing.amenities) && listing.amenities.length > 0 && (
              <p className="mt-2 text-sm text-ink">
                <span className="text-ink-muted">Amenities: </span>
                {listing.amenities.map((a: string) => amenityLabel(a)).join(", ")}
              </p>
            )}
            {listing.description ? (
              <p className="mt-2 text-sm text-ink whitespace-pre-wrap">
                {listing.description}
              </p>
            ) : (
              <p className="mt-2 text-sm text-red-700">No description yet</p>
            )}
            {(listing.meetingPoint ||
              listing.durationDays ||
              listing.durationHours) && (
              <p className="mt-2 text-sm text-ink">
                {listing.durationDays
                  ? `${listing.durationDays}d `
                  : ""}
                {listing.durationHours
                  ? `${listing.durationHours}h `
                  : ""}
                {listing.meetingPoint
                  ? `· Meet: ${listing.meetingPoint}`
                  : ""}
              </p>
            )}
            <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-muted">Phone</dt>
                <dd>{listing.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Hours</dt>
                <dd>{listing.openingHours || "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Website</dt>
                <dd className="truncate">{listing.website || "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Address</dt>
                <dd>{listing.address || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-ink-muted">Payments</dt>
                <dd>
                  {[
                    listing.acceptMpesa !== false && "M-Pesa",
                    listing.acceptCard !== false && "Card",
                    listing.acceptCashOnArrival !== false && "Cash",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Photos */}
          <div className="border border-line bg-white/90 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-lake">2. Photos</h3>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-medium text-lake-bright underline"
              >
                Edit
              </button>
            </div>
            {listing.media?.length ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {listing.media.map((m: { id: string; url: string; isCover?: boolean; alt?: string | null }) => (
                  <div
                    key={m.id}
                    className={`relative overflow-hidden border ${
                      m.isCover ? "border-lake ring-1 ring-lake/30" : "border-line"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                    {m.isCover && (
                      <span className="absolute bottom-0 left-0 right-0 bg-lake/90 px-1 py-0.5 text-[10px] text-sand">
                        Thumbnail
                      </span>
                    )}
                    {(m.alt || "").toLowerCase().includes("flyer") && (
                      <span className="absolute top-0 left-0 bg-sun/90 px-1 py-0.5 text-[10px] text-ink">
                        Flyer
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-red-700">No photos yet</p>
            )}
          </div>

          {/* Offers */}
          <div className="border border-line bg-white/90 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-lake">3. Offers</h3>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs font-medium text-lake-bright underline"
              >
                Edit
              </button>
            </div>
            {listing.roomTypes?.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {listing.roomTypes.map(
                  (r: {
                    id: string;
                    name: string;
                    offerKind?: string;
                    quantity: number;
                    basePrice: number;
                    dayUsePrice?: number | null;
                    maxGuests?: number;
                  }) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-2 last:border-0"
                    >
                      <span>
                        <span className="font-medium">{r.name}</span>
                        <span className="text-ink-muted">
                          {" "}
                          · {offerKindLabel(r.offerKind)}
                          {r.maxGuests ? ` · ${r.maxGuests} guests` : ""}
                          {` · qty ${r.quantity}`}
                        </span>
                      </span>
                      <span className="font-semibold text-lake">
                        KES {Number(r.basePrice).toLocaleString()}
                        {r.dayUsePrice != null
                          ? ` · day ${Number(r.dayUsePrice).toLocaleString()}`
                          : ""}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-red-700">No offers yet</p>
            )}
          </div>

          {/* Location */}
          <div className="border border-line bg-white/90 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-lake">4. Location</h3>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-xs font-medium text-lake-bright underline"
              >
                Edit
              </button>
            </div>
            <p className="mt-2 text-sm text-ink">
              {[
                listing.town?.name,
                listing.county?.name,
                listing.county?.country?.name,
              ]
                .filter(Boolean)
                .join(" / ") || "Town / county not set"}
            </p>
            {listing.address && (
              <p className="mt-1 text-sm text-ink-muted">{listing.address}</p>
            )}
            {listing.latitude != null && listing.longitude != null ? (
              <>
                <p className="mt-1 text-xs text-ink-muted">
                  Pin {Number(listing.latitude).toFixed(5)},{" "}
                  {Number(listing.longitude).toFixed(5)}
                  {listing.locationConfirmed ? " · confirmed" : ""}
                </p>
                <iframe
                  title="Map preview"
                  className="mt-3 h-40 w-full border border-line"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.longitude - 0.04}%2C${listing.latitude - 0.04}%2C${listing.longitude + 0.04}%2C${listing.latitude + 0.04}&layer=mapnik&marker=${listing.latitude}%2C${listing.longitude}`}
                />
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">
                {requiresMapLocation(listingKinds)
                  ? "Map pin missing — add GPS on the Location step"
                  : "No map pin (optional for this listing type)"}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 border border-line bg-sand/30 p-4">
          <h3 className="text-sm font-semibold text-ink">Ready checklist</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              ["description", "About / description"],
              ["photo", "At least one photo"],
              ["offer", "At least one offer with a price"],
              [
                "location",
                requiresMapLocation(listingKinds)
                  ? "Map location"
                  : "Map location (optional)",
              ],
            ].map(([key, label]) => (
              <li key={key} className="flex items-center gap-2">
                <span
                  className={checks?.[key] ? "text-lake" : "text-ink-muted"}
                >
                  {checks?.[key] ? "✓" : "○"}
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href={publicListingPath(listing)}
            className="text-lake-bright underline"
            target="_blank"
          >
            Open public page preview
          </Link>
          {listing.provider?.slug && (
            <Link
              href={publicProviderPath(listing.provider)}
              className="text-lake-bright underline"
              target="_blank"
            >
              Your storefront
            </Link>
          )}
        </div>

        {listing.status !== "PUBLISHED" && publishFeeKes > 0 && (
          <div className="mt-6 space-y-3 rounded-lg border border-line bg-sand/20 p-4">
            <p className="text-sm font-semibold text-ink">
              Publish fee · KES {publishFeeKes.toLocaleString()}
            </p>
            {publishPaybill && (
              <p className="text-sm text-ink-muted">
                Paybill / till:{" "}
                <span className="font-mono font-medium text-ink">
                  {publishPaybill}
                </span>
              </p>
            )}
            {publishInstructions && (
              <p className="text-sm text-ink-muted whitespace-pre-wrap">
                {publishInstructions}
              </p>
            )}
            <label className="block text-sm">
              <span className="font-medium text-ink">
                M-Pesa confirmation code
              </span>
              <input
                value={publishPaymentRef}
                onChange={(e) => setPublishPaymentRef(e.target.value)}
                disabled={disabled || listing.status === "PENDING_REVIEW"}
                placeholder="e.g. QGH7… or Till receipt"
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-muted">Note (optional)</span>
              <input
                value={publishPaymentNote}
                onChange={(e) => setPublishPaymentNote(e.target.value)}
                disabled={disabled || listing.status === "PENDING_REVIEW"}
                placeholder="Amount paid, phone used…"
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || listing.status === "PENDING_REVIEW"}
            onClick={() => void submitPublish()}
            className="rounded-md bg-lake px-5 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
          >
            {busy === "publish"
              ? "Working…"
              : listing.status === "PENDING_REVIEW"
                ? "Awaiting payment verification"
                : listing.status === "PUBLISHED"
                  ? "Live"
                  : publishFeeKes > 0
                    ? "Pay & publish"
                    : "Publish listing"}
          </button>
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          {listing.status === "PUBLISHED"
            ? "Your listing is live. Optional: request a paid boost above to feature it."
            : listing.status === "PENDING_REVIEW"
              ? "Payment received for verification — guests will see this listing once confirmed."
              : publishFeeKes > 0
                ? "Pay the publish fee, paste your M-Pesa code, then submit. Your business must already be approved."
                : "When the checklist is complete, publish to go live immediately."}
        </p>
      </section>
      )}

      {(step === 1 || step === 2) && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={goBack}
            className="rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink-muted"
          >
            ← Back
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={goNext}
            className="rounded-md bg-lake px-5 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
          >
            Continue →
          </button>
        </div>
      )}
      {step === 3 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={goBack}
            className="rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink-muted"
          >
            ← Back
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setError(null);
              if (
                requiresMapLocation(listingKinds) &&
                (listing.latitude == null || listing.longitude == null)
              ) {
                setError("Add a map pin before continuing (or use GPS)");
                return;
              }
              setStep(4);
            }}
            className="rounded-md bg-lake px-5 py-2.5 text-sm font-semibold text-sand disabled:opacity-60"
          >
            Continue to submit →
          </button>
        </div>
      )}
      {step === 4 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={goBack}
            className="rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink-muted"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
