/**
 * Convert a brand hex color into the CSS custom-property overrides used by
 * the customer ordering pages. Apply the returned object as `style={...}` on
 * the wrapper of any DOM subtree that should follow the restaurant's color —
 * every Tailwind `bg-primary` / `text-primary` / `border-primary` inside that
 * subtree automatically resolves to the new color via `hsl(var(--primary))`.
 */
import type { CSSProperties } from "react";

type Hsl = { h: number; s: number; l: number };

/** Parse `#rgb` or `#rrggbb` (with or without leading `#`) into [r,g,b] (0-255). */
function parseHex(hex: string): [number, number, number] | null {
  const value = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(value)) return null;
  let r: number, g: number, b: number;
  if (value.length === 3) {
    r = parseInt(value[0] + value[0], 16);
    g = parseInt(value[1] + value[1], 16);
    b = parseInt(value[2] + value[2], 16);
  } else if (value.length === 6) {
    r = parseInt(value.slice(0, 2), 16);
    g = parseInt(value.slice(2, 4), 16);
    b = parseInt(value.slice(4, 6), 16);
  } else {
    return null;
  }
  return [r, g, b];
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN:
        h = (gN - bN) / d + (gN < bN ? 6 : 0);
        break;
      case gN:
        h = (bN - rN) / d + 2;
        break;
      case bN:
        h = (rN - gN) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** WCAG relative luminance (0..1). */
function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function toTriplet({ h, s, l }: Hsl): string {
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

/**
 * Returns CSS custom property overrides for the brand color, or `undefined`
 * if the hex is missing/invalid. Apply via `style={brandColorCssVars(color)}`
 * on the customer ordering page root.
 */
export function brandColorCssVars(
  hex: string | null | undefined
): CSSProperties | undefined {
  if (!hex) return undefined;
  const rgb = parseHex(hex);
  if (!rgb) return undefined;
  const [r, g, b] = rgb;
  const hsl = rgbToHsl(r, g, b);
  const primary = toTriplet(hsl);

  // Pick a readable foreground for text/icons placed on the brand color.
  // > 0.55 relative luminance → background is light, use near-black; else white.
  const fg =
    relativeLuminance(r, g, b) > 0.55 ? "220 10% 15%" : "0 0% 100%";

  return {
    "--primary": primary,
    "--primary-foreground": fg,
    "--ring": primary,
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": fg,
  } as CSSProperties;
}
