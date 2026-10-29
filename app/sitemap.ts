import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://quakewatch.web.id";
  return [""].map((u) => ({ url: `${base}${u}` }));
}
