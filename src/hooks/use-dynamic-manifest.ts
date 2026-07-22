import { useLayoutEffect } from "react";

/**
 * Updates <link rel="manifest"> to a restaurant-specific manifest served
 * by /api/manifest so Chrome installs the correct restaurant ordering app.
 *
 * Uses useLayoutEffect so the update happens synchronously before the
 * browser finalises PWA installability criteria and fires beforeinstallprompt.
 */
export function useDynamicManifest({
  name,
  startUrl,
  themeColor = "#FF4500",
}: {
  name: string;
  startUrl: string;
  themeColor?: string;
}) {
  useLayoutEffect(() => {
    if (!name || !startUrl) return;

    const params = new URLSearchParams({
      name,
      start_url: startUrl,
      color: themeColor,
    });

    const manifestUrl = `/api/manifest?${params.toString()}`;

    let linkEl = document.querySelector(
      'link[rel="manifest"]'
    ) as HTMLLinkElement | null;

    // Create the element if it doesn't exist (shouldn't happen, but just in case)
    if (!linkEl) {
      linkEl = document.createElement("link");
      linkEl.rel = "manifest";
      document.head.appendChild(linkEl);
    }

    const previous = linkEl.href;
    linkEl.href = manifestUrl;

    // Update <meta name="theme-color"> to match the brand
    const themeMeta = document.querySelector(
      'meta[name="theme-color"]'
    ) as HTMLMetaElement | null;
    if (themeMeta) themeMeta.content = themeColor;

    // Restore on unmount (in case user navigates to a non-restaurant page)
    return () => {
      if (linkEl) linkEl.href = previous;
      if (themeMeta) themeMeta.content = "#FF4500";
    };
  }, [name, startUrl, themeColor]);
}
