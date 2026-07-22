/** Canonical Flaze product brand (display / marketing). */

export const BRAND = {
  name: "Flaze",
  nameLower: "flaze",
  tagline: "Built for every food business",
  siteUrl: "https://flazee.com",
  siteHost: "flazee.com",
  supportEmail: "connect@flazee.com",
  supportMailto: "mailto:connect@flazee.com",
  twitterHandle: "@flazee",
  razorpayDisplayName: "Flaze",
  poweredByLabel: "Powered by flazee.com",
  orderNote: "Flaze order",
  /** Logo "e" / primary action — sampled from brand mark */
  themeColor: "#FF4500",
  colors: {
    /** Outer flame tips */
    flameRed: "#E80808",
    /** Wordmark "e" and primary CTA */
    flameOrange: "#FF4500",
    /** Mid-flame gold */
    flameGold: "#F89800",
    /** Inner flame highlight */
    flameYellow: "#FFCC33",
    /** Soft cream from flame core */
    cream: "#F8F0D0",
    /** Warm page canvas */
    creamCanvas: "#FFF8F0",
    black: "#000000",
    white: "#FFFFFF",
  },
  assets: {
    symbol: "/brand/flaze-symbol.png",
    logoWhite: "/brand/flaze-logo-white.png",
    logoDark: "/brand/flaze-logo-dark.png",
    logoWhiteTagline: "/brand/flaze-logo-white-tagline.png",
    logoDarkTagline: "/brand/flaze-logo-dark-tagline.png",
    /** Compact favicon / PWA / sidebar mark */
    logo: "/logo.png",
    og: "/og-default.png",
  },
} as const;

export type BrandAssets = typeof BRAND.assets;
