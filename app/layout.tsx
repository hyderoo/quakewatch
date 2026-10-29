import type { Metadata, Viewport } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.built.css";

export const metadata: Metadata = {
  title: "QuakeWatch — Global Seismic Intelligence",
  description:
    "Real-time earthquake monitoring dashboard powered by the USGS Earthquake Hazards Program. Worldwide coverage with a focus on Indonesia and the Pacific Ring of Fire.",
  metadataBase: new URL("https://quakewatch.web.id"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "QuakeWatch — Global Seismic Intelligence",
    description: "Real-time earthquake monitoring dashboard powered by the USGS Earthquake Hazards Program. Worldwide coverage with a focus on Indonesia and the Pacific Ring of Fire.",
    type: "website",
  },
  twitter: { card: "summary" },
};

export const viewport: Viewport = { themeColor: "#0a0f1e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className="dark"><body>{children}</body></html>;
}
