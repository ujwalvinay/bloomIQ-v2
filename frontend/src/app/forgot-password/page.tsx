import Image from "next/image";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen">
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
            A fresh password keeps your conservatory secure. We&apos;ll email you
            a one-time link.
          </p>
        </div>
      </section>

      <section className="flex flex-1 flex-col items-center justify-center bg-cream px-6 py-12 sm:px-10">
        <div className="mb-8 w-full max-w-md lg:hidden">
          <Link
            href="/"
            className="text-sm font-semibold tracking-wide text-olive"
          >
            BloomIQ
          </Link>
        </div>
        <ForgotPasswordForm />
      </section>
    </div>
  );
}
