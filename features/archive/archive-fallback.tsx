import { Skeleton } from "@/components/ui/states";

export function ArchiveFallback() {
  return (
    <div className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]" aria-busy="true">
      <div className="hidden space-y-3 lg:block">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
      <div>
        <Skeleton className="mb-6 h-9 w-full" />
        <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[16/10] w-full rounded-lg" />
              <Skeleton className="mt-3 h-3.5 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
