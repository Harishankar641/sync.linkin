import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SyncedIn",
    short_name: "SyncedIn",
    description: "AI-powered professional networking",
    start_url: "/",
    display: "standalone",
  };
}