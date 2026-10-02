"use client";

import { Container } from "@/components/layout/page";
import { ErrorState } from "@/components/ui/states";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="py-24">
      <ErrorState title="This page failed to load" description={error.digest ? `Reference: ${error.digest}` : "An unexpected error occurred."} onRetry={reset} />
    </Container>
  );
}
