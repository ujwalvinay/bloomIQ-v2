import type { Metadata } from "next";
import { HelpCenterContent } from "@/components/help/HelpCenterContent";

export const metadata: Metadata = {
  title: "Help center | BloomIQ",
  description:
    "Guides for BloomIQ: dashboard, plants, calendar, insights, account, and FAQs.",
};

export default function HelpPage() {
  return (
    <main>
      <HelpCenterContent />
    </main>
  );
}
