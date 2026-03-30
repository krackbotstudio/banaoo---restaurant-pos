import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Minimum images we want in the global library before returning from cache
const MIN_LIBRARY_SIZE = 5;
// How many to return to the picker
const RETURN_COUNT = 8;

interface Photo {
  image_url: string;
  thumb_url: string;
  source: string;
}

/** Normalise dish name for consistent DB lookup */
function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

/** TheMealDB — free, no API key, good for common dishes */
async function fromTheMealDB(query: string): Promise<Photo[]> {
  try {
    const res = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.meals) return [];
    return data.meals.slice(0, 6).map((m: Record<string, string>) => ({
      image_url: m.strMealThumb,
      thumb_url: m.strMealThumb,
      source: "TheMealDB",
    }));
  } catch {
    return [];
  }
}

/** Wikipedia — free, no API key, works for most named dishes */
async function fromWikipedia(query: string): Promise<Photo[]> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { headers: { "User-Agent": "banaoo-restaurant-app/1.0" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.thumbnail?.source) return [];
    return [{
      image_url: data.originalimage?.source || data.thumbnail.source,
      thumb_url: data.thumbnail.source,
      source: "Wikipedia",
    }];
  } catch {
    return [];
  }
}

/** Unsplash — free with API key (5000/month), high quality food photos */
async function fromUnsplash(query: string, key: string): Promise<Photo[]> {
  try {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", `${query} food dish`);
    url.searchParams.set("per_page", "8");
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("client_id", key);
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((p: Record<string, unknown>) => {
      const urls = p.urls as Record<string, string>;
      return { image_url: urls.regular, thumb_url: urls.small, source: "Unsplash" };
    });
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { item_name } = await req.json() as { item_name: string };
    if (!item_name?.trim()) {
      return new Response(JSON.stringify({ error: "item_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const searchTerm = normalize(item_name);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Check global image library ──────────────────────────────────────
    const { data: cached } = await supabase
      .from("menu_item_images")
      .select("image_url, thumb_url, source")
      .eq("search_term", searchTerm);

    const cachedPhotos: Photo[] = cached || [];
    console.log(`Cache hit for "${searchTerm}": ${cachedPhotos.length} images`);

    if (cachedPhotos.length >= MIN_LIBRARY_SIZE) {
      // Shuffle so different users get different images at the top
      const shuffled = cachedPhotos
        .sort(() => Math.random() - 0.5)
        .slice(0, RETURN_COUNT);
      return new Response(
        JSON.stringify({ photos: shuffled.map(p => ({ url: p.image_url, thumb: p.thumb_url, source: p.source })) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Need more images — fetch from external sources ─────────────────
    const existingUrls = new Set(cachedPhotos.map((p) => p.image_url));
    const newPhotos: Photo[] = [];

    const addUnique = (photos: Photo[]) => {
      for (const p of photos) {
        if (!existingUrls.has(p.image_url)) {
          newPhotos.push(p);
          existingUrls.add(p.image_url);
        }
      }
    };

    // Try TheMealDB first (no key needed)
    console.log(`Fetching from TheMealDB for "${item_name}"…`);
    addUnique(await fromTheMealDB(item_name));

    // If still not enough, try Wikipedia (no key needed)
    if (cachedPhotos.length + newPhotos.length < MIN_LIBRARY_SIZE) {
      console.log(`Fetching from Wikipedia for "${item_name}"…`);
      addUnique(await fromWikipedia(item_name));
    }

    // If still not enough and Unsplash key is set, use it
    const unsplashKey = Deno.env.get("UNSPLASH_ACCESS_KEY");
    if (cachedPhotos.length + newPhotos.length < MIN_LIBRARY_SIZE && unsplashKey) {
      console.log(`Fetching from Unsplash for "${item_name}"…`);
      addUnique(await fromUnsplash(item_name, unsplashKey));
    }

    // ── 3. Store new images in the global library ──────────────────────────
    if (newPhotos.length > 0) {
      const { error: insertError } = await supabase.from("menu_item_images").insert(
        newPhotos.map((p) => ({ ...p, search_term: searchTerm }))
      );
      if (insertError) {
        // Unique constraint violations are fine (race condition between users)
        console.warn("Insert warning:", insertError.message);
      }
      console.log(`Stored ${newPhotos.length} new images for "${searchTerm}"`);
    }

    // ── 4. Return combined, shuffled pool ──────────────────────────────────
    const allPhotos = [...cachedPhotos, ...newPhotos];
    if (allPhotos.length === 0) {
      return new Response(
        JSON.stringify({ photos: [], message: "No images found for this dish" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = allPhotos
      .sort(() => Math.random() - 0.5)
      .slice(0, RETURN_COUNT)
      .map((p) => ({ url: p.image_url, thumb: p.thumb_url, source: p.source }));

    return new Response(JSON.stringify({ photos: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-menu-image error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
