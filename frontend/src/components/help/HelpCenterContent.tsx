import type { ReactNode } from "react";
import {
  Calendar,
  ChevronRight,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Settings,
  Sparkles,
  Sprout,
} from "lucide-react";
import Link from "next/link";

function QuickLinkCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex gap-4 rounded-[20px] bg-white p-5 shadow-soft ring-1 ring-black/[0.05] transition hover:ring-forest/25 hover:shadow-md"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sage/80 text-forest">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-semibold text-ink">{title}</span>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-forest"
            aria-hidden
          />
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-muted">
          {description}
        </span>
      </span>
    </Link>
  );
}

function TopicSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-[22px] bg-white p-6 shadow-soft ring-1 ring-black/[0.04] sm:p-8"
    >
      <h2 className="text-lg font-bold text-forest">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-ink">
        {children}
      </div>
    </section>
  );
}

function FaqItem({ question, answer }: { question: string; answer: ReactNode }) {
  return (
    <details className="group rounded-2xl bg-archive-cream/90 ring-1 ring-black/[0.06] open:bg-white open:shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 pr-12 font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="relative block">
          {question}
          <ChevronRight className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition group-open:rotate-90" />
        </span>
      </summary>
      <div className="border-t border-black/[0.06] px-5 pb-4 pt-2 text-sm leading-relaxed text-muted">
        {answer}
      </div>
    </details>
  );
}

export function HelpCenterContent() {
  return (
    <div className="min-h-screen bg-care-canvas px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
          Support
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Help center
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Guides for BloomIQ—your conservatory dashboard, plants, calendar, insights,
          and account. Jump to a topic below or open the sections that match what you
          are trying to do.
        </p>
      </header>

      <nav
        className="mx-auto mt-10 max-w-4xl"
        aria-label="On this page"
      >
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
          Jump to
        </p>
        <ul className="flex flex-wrap justify-center gap-2">
          {[
            { href: "#quick-links", label: "Quick links" },
            { href: "#getting-started", label: "Getting started" },
            { href: "#plants", label: "Plants" },
            { href: "#tasks-calendar", label: "Tasks & calendar" },
            { href: "#insights", label: "Insights" },
            { href: "#account", label: "Account" },
            { href: "#faq", label: "FAQ" },
          ].map((j) => (
            <li key={j.href}>
              <a
                href={j.href}
                className="inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-forest ring-1 ring-black/[0.08] transition hover:bg-sage/60"
              >
                {j.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div
        id="quick-links"
        className="mx-auto mt-12 grid max-w-4xl scroll-mt-24 gap-4 sm:grid-cols-2"
      >
        <QuickLinkCard
          href="/dashboard"
          title="Dashboard"
          description="See today’s tasks, quick stats, and featured plants."
          icon={<LayoutDashboard className="h-6 w-6" strokeWidth={1.75} aria-hidden />}
        />
        <QuickLinkCard
          href="/plants"
          title="My plants"
          description="Browse, filter, and open any specimen in your archive."
          icon={<Sprout className="h-6 w-6" strokeWidth={1.75} aria-hidden />}
        />
        <QuickLinkCard
          href="/calendar"
          title="Care calendar"
          description="Month or week view of scheduled and completed care."
          icon={<Calendar className="h-6 w-6" strokeWidth={1.75} aria-hidden />}
        />
        <QuickLinkCard
          href="/settings"
          title="Settings"
          description="Profile, notifications, and password."
          icon={<Settings className="h-6 w-6" strokeWidth={1.75} aria-hidden />}
        />
      </div>

      <div className="mx-auto mt-14 flex max-w-3xl flex-col gap-8">
        <TopicSection id="getting-started" title="Getting started">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <strong>Create an account</strong> from the sign-up page, then sign in.
              Your session uses secure cookies issued by the server.
            </li>
            <li>
              <strong>Add a plant</strong> from{" "}
              <Link href="/plants/add" className="font-semibold text-forest underline-offset-2 hover:underline">
                Add plant
              </Link>
              . BloomIQ can suggest light level and care notes when an AI key is
              configured on the server.
            </li>
            <li>
              <strong>Set care plans</strong> (watering, fertilizing, pruning) so tasks
              appear on your dashboard and calendar in your account timezone.
            </li>
            <li>
              <strong>Complete tasks</strong> from the dashboard or calendar to keep
              schedules and history accurate.
            </li>
          </ol>
        </TopicSection>

        <TopicSection id="plants" title="Plants & archive">
          <p>
            Each plant has an <strong>overview</strong>, <strong>care chat</strong> (AI
            assistant when configured), <strong>gallery</strong>, and{" "}
            <strong>history</strong>. Use the archive header tabs to switch views.
          </p>
          <p>
            Mark a plant as <strong>needs attention</strong> when something looks off;
            healthy and archived statuses help you filter lists and insights.
          </p>
          <p>
            Photos can be uploaded or linked; some images load directly from the API
            for reliability in development.
          </p>
        </TopicSection>

        <TopicSection id="tasks-calendar" title="Tasks & calendar">
          <p>
            <strong>Dashboard</strong> lists tasks due today and overdue items first.
            You can add <strong>custom one-off tasks</strong> tied to a plant without
            changing recurring care plans.
          </p>
          <p>
            The <strong>calendar</strong> shows marks for scheduled and completed care
            by day. Tap a day to review and complete tasks. Times follow your profile
            timezone in{" "}
            <Link href="/settings" className="font-semibold text-forest underline-offset-2 hover:underline">
              Settings
            </Link>
            .
          </p>
        </TopicSection>

        <TopicSection id="insights" title="Insights & AI brief">
          <p className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
            <span>
              The <strong>Insights</strong> page combines collection stats, workload
              signals, and an optional <strong>AI conservatory brief</strong>. Use{" "}
              <strong>Regenerate from data</strong> to refresh the brief from your live
              plants and dashboard counts, or edit the text and <strong>Save my edits</strong>.
              If your stats change, the page shows when the brief may be stale.
            </span>
          </p>
          <p>
            AI features require a Gemini API key on the server; without it, generation
            steps return a clear “not configured” message.
          </p>
        </TopicSection>

        <TopicSection id="account" title="Account & security">
          <p>
            Update your display name and notification preferences under{" "}
            <Link href="/settings" className="font-semibold text-forest underline-offset-2 hover:underline">
              Settings
            </Link>
            .
          </p>
          <p>
            To <strong>change your password</strong>, open{" "}
            <strong>Security & access → Change password</strong>. You will enter your
            current password, choose a new one, and then be signed out—sign back in with
            the new password.
          </p>
          <p>
            Sign out anytime from the sidebar (desktop) or the drawer menu (mobile).
          </p>
        </TopicSection>

        <section
          id="faq"
          className="scroll-mt-24 rounded-[22px] bg-white p-6 shadow-soft ring-1 ring-black/[0.04] sm:p-8"
        >
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-forest" strokeWidth={1.75} aria-hidden />
            <h2 className="text-lg font-bold text-forest">Frequently asked questions</h2>
          </div>
          <div className="mt-6 space-y-3">
            <FaqItem
              question="Why don’t I see AI suggestions for my plant?"
              answer={
                <>
                  The server needs a configured{" "}
                  <strong className="text-ink">Gemini / Google AI API key</strong>. Ask
                  whoever runs your BloomIQ deployment to set{" "}
                  <code className="rounded bg-input-deep px-1.5 py-0.5 text-xs text-ink">
                    GEMINI_API_KEY
                  </code>{" "}
                  (or <code className="rounded bg-input-deep px-1.5 py-0.5 text-xs">GOOGLE_API_KEY</code>) in the backend environment.
                </>
              }
            />
            <FaqItem
              question="Why was I signed out after changing my password?"
              answer="That is intentional. Updating your password ends the current session so any old tokens are invalidated. Sign in again with your new password."
            />
            <FaqItem
              question="Tasks look wrong for “today”—what should I check?"
              answer={
                <>
                  Confirm your <strong className="text-ink">timezone</strong> in Settings
                  matches where you care for your plants. Due dates are interpreted in
                  that timezone.
                </>
              }
            />
            <FaqItem
              question="Can I use BloomIQ on my phone?"
              answer="Yes. Below the large breakpoint you get a top bar (logo, notifications, menu) and a slide-out navigation drawer. The calendar and forms are laid out for smaller screens."
            />
            <FaqItem
              question="Where is my data stored?"
              answer="Plant and account data live in the MongoDB database connected to your BloomIQ backend. Only your deployment operators can answer specifics about backups and retention."
            />
          </div>
        </section>

        <section className="rounded-[22px] border border-dashed border-forest/25 bg-sage/30 px-6 py-8 text-center sm:px-10">
          <Mail className="mx-auto h-8 w-8 text-forest" strokeWidth={1.5} aria-hidden />
          <h2 className="mt-4 text-lg font-bold text-ink">Still stuck?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            This help center is built into the app. For billing, data export, or account
            deletion requests, contact whoever hosts your BloomIQ instance or your team
            admin—there is no in-app ticket queue in this version.
          </p>
          <p className="mt-4 text-xs text-muted">
            BloomIQ — calmer plant care, one task at a time.
          </p>
        </section>
      </div>
    </div>
  );
}
