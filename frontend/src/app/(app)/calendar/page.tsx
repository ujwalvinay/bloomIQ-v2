import { CareCalendarContent } from "@/components/calendar/CareCalendarContent";

export default function CalendarPage() {
  return (
    <main className="fixed bottom-0 left-0 right-0 top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-0 flex min-h-0 w-full min-w-0 flex-col overflow-hidden bg-care-canvas pl-0 lg:top-0 lg:pl-[280px]">
      <CareCalendarContent />
    </main>
  );
}
