import { NextResponse } from "next/server";
import { buildSearchDocs } from "@/features/search/build-docs";

/** Static search index for the client-side engine; regenerated with the content. */
export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  const docs = await buildSearchDocs();
  return NextResponse.json({ docs, generatedAt: new Date().toISOString() });
}
