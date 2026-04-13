import { CareCalendarContent } from "@/components/calendar/CareCalendarContent";

export default function CalendarPage() {
  return (
    <main className="fixed inset-0 left-0 z-0 flex h-dvh w-full min-h-0 min-w-0 max-w-none flex-col overflow-hidden bg-cream pl-[280px]">
      <CareCalendarContent />
    </main>
  );
}
