import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-forest-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-contour-lines opacity-40"
      />
      <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-16">
        <Link href="/" className="mb-10" aria-label="Golf Trip Treasurer home">
          <Logo variant="light" />
        </Link>
        <div className="w-full max-w-md rounded-2xl bg-cream-50 p-8 shadow-card sm:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}
