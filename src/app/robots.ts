import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/profile/"],
    },
    sitemap: "https://ilestays.ng/sitemap.xml",
  };
}
