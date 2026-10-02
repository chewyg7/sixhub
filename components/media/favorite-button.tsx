"use client";

import { Heart } from "lucide-react";
import { library, useLibrary } from "@/features/library/store";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/icon-button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button";

export function FavoriteButton({
  slug,
  title,
  size = "icon-sm",
  variant = "ghost",
  className,
}: {
  slug: string;
  title: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
}) {
  const fav = useLibrary((s) => s.favorites.some((f) => f.slug === slug));
  return (
    <IconButton
      label={fav ? `Remove “${title}” from favorites` : `Add “${title}” to favorites`}
      size={size}
      variant={variant}
      pressed={fav}
      onClick={(e) => {
        e.stopPropagation();
        library.toggleFavorite(slug);
      }}
      className={cn(fav && "text-accent-text", className)}
    >
      <Heart className={cn("transition-transform duration-200", fav && "fill-current")} />
    </IconButton>
  );
}
