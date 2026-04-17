import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function LoginPage({ searchParams }: Props) {
  const registered = searchParams.registered === "1";
  const resetOk = searchParams.reset === "1";

  return (
    <div className="flex min-h-[100dvh]">
      <section className="relative hidden w-[58%] min-h-screen lg:block">
        <Image
          src="https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=1600&q=80"
          alt="Monstera plant leaves"
          fill
          className="object-cover"
          priority
          sizes="58vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/30" />
        <div className="absolute inset-0 flex flex-col justify-end p-12 xl:p-16">
          <Link
            href="/"
            className="mb-auto self-start text-sm font-medium text-white/90 hover:text-white"
          >
            ← Home
          </Link>
          <h2 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
            BloomIQ
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/85">
            Curating thoughtful plant care for your digital conservatory—schedules,
            reminders, and growth in one calm place.
          </p>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col items-center justify-center bg-cream px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-10 sm:py-12">
        {registered ? (
          <p className="mb-4 w-full max-w-md rounded-full bg-olive/10 px-4 py-2 text-center text-sm text-olive-dark">
            Account created. Sign in to continue.
          </p>
        ) : null}
        {resetOk ? (
          <p className="mb-4 w-full max-w-md rounded-full bg-olive/10 px-4 py-2 text-center text-sm text-olive-dark">
            Password updated. Sign in with your new password.
          </p>
        ) : null}
        <LoginForm />
      </section>
    </div>
  );
}
