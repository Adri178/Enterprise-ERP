import Link from "next/link";
import { id } from "@/lib/i18n";
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background"
    >
      <p className="text-sm text-primary">404</p>
      <h1 className="text-2xl font-semibold">{id.notFound}</h1>
      <Link href="/dashboard" className="text-sm text-primary underline">
        {id.backDashboard}
      </Link>
    </main>
  );
}
