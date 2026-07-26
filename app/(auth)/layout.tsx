import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-page-bg flex flex-col items-center justify-center px-4">
      <Link
        href="/"
        className="text-2xl font-bold text-primary tracking-tight mb-10"
        aria-label="TutorPortal — go to home"
      >
        TutorPortal
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
