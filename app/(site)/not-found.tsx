import Link from "next/link";
import { Container } from "@/components/layout/page";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-start justify-center py-20">
      <p className="eyebrow">404</p>
      <h1 className="display mt-3 text-[48px] sm:text-[64px]">This page doesn&apos;t exist.</h1>
      <p className="mt-4 max-w-md text-[15px] text-muted">It may have moved, or the link may be wrong. Search, or head back to the archive.</p>
      <div className="mt-8 flex gap-2">
        <Link href="/" className={buttonClass({ variant: "primary" })}>
          Home
        </Link>
        <Link href="/media" className={buttonClass({ variant: "secondary" })}>
          Media archive
        </Link>
        <Link href="/search" className={buttonClass({ variant: "ghost" })}>
          Search
        </Link>
      </div>
    </Container>
  );
}
