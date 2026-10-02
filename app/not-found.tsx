import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import SiteNotFound from "./(site)/not-found";

/** Unmatched URLs render outside route groups, so include the site chrome here. */
export default function RootNotFound() {
  return (
    <>
      <SiteHeader previews={{}} />
      <main id="main" className="pt-24">
        <SiteNotFound />
      </main>
      <Footer />
    </>
  );
}
