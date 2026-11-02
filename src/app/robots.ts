import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/search", "/about", "/become-a-host", "/host", "/stay/", "/terms", "/privacy"],
        disallow: [
          "/admin/",
          "/api/",
          "/host/dashboard/",
          "/host/onboarding/",
          "/profile/",
          "/messages/",
          "/trips/",
          "/login",
          "/signup",
          "/register",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: "https://ilestays.ng/sitemap.xml",
  };
}
