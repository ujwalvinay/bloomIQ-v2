import Image from "next/image";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-cream px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-14">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center">
        <div className="overflow-hidden rounded-[2rem] bg-white shadow-card lg:flex lg:min-h-[560px]">
          <section className="relative hidden min-h-[280px] w-full lg:block lg:w-1/2 lg:min-h-full">
            <Image
              src="https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1400&q=80"
              alt="Tropical leaves in soft light"
              fill
              className="object-cover"
              sizes="50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-olive/90 via-olive/70 to-olive-dark/85 mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8 xl:p-10">
              <h2 className="max-w-sm text-3xl font-semibold leading-tight text-white xl:text-4xl">
                Cultivating digital growth.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/90">
                Join a community of plant enthusiasts documenting care, growth,
                and the quiet joy of healthy leaves.
              </p>
            </div>
          </section>

          <section className="flex flex-1 flex-col justify-center bg-white p-6 sm:p-10 lg:w-1/2 lg:rounded-none">
            <div className="mx-auto w-full max-w-xl">
              <SignupForm />
            </div>
          </section>
        </div>
      </div>

      <p className="mt-8 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-muted/80">
        © {new Date().getFullYear()} BloomIQ
      </p>
    </div>
  );
}
