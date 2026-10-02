export interface NewsSource {
  name: string;
  url: string;
}

export interface NewsImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface NewsArticle {
  /** Stable id derived from the source's GUID. */
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  excerpt: string;
  author?: string;
  categories: string[];
  image?: NewsImage;
  source: NewsSource;
}

export interface NewsPage {
  articles: NewsArticle[];
  page: number;
  hasMore: boolean;
  scope: NewsScope;
  query?: string;
  fetchedAt: string;
}

/** `gta6` limits to the source's GTA 6 category; `all` includes all Rockstar coverage. */
export type NewsScope = "gta6" | "all";
