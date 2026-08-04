import { redirect } from "next/navigation";

/** Legacy route — inquiries live under Inbox → Leads. */
export default function ProviderInquiriesRedirect() {
  redirect("/provider/inbox?tab=leads");
}
