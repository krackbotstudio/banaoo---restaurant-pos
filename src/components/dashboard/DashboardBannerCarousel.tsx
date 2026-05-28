import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, Megaphone, Newspaper, Tag } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useDashboardBanners,
  type DashboardBanner,
  type DashboardBannerKind,
  type DashboardBannerTheme,
} from "@/hooks/use-dashboard-banners";
import { useProductTour } from "@/lib/product-tour/tour-context";

const KIND_META: Record<
  DashboardBannerKind,
  { label: string; icon: typeof Newspaper; badgeClass: string }
> = {
  news: {
    label: "News",
    icon: Newspaper,
    badgeClass: "bg-white/20 text-white border-white/30",
  },
  offer: {
    label: "Offer",
    icon: Tag,
    badgeClass: "bg-amber-400/25 text-amber-50 border-amber-200/40",
  },
  commercial: {
    label: "Featured",
    icon: Megaphone,
    badgeClass: "bg-white/20 text-white border-white/30",
  },
};

const THEME_STYLES: Record<DashboardBannerTheme, string> = {
  warm: "from-orange-600 via-primary to-amber-500",
  cool: "from-sky-700 via-blue-600 to-cyan-500",
  offer: "from-emerald-700 via-green-600 to-lime-500",
  violet: "from-violet-700 via-purple-600 to-fuchsia-500",
};

const AUTOPLAY_MS = 6500;

function BannerSlide({
  banner,
  onTourCta,
}: {
  banner: DashboardBanner;
  onTourCta?: () => void;
}) {
  const meta = KIND_META[banner.kind];
  const Icon = meta.icon;
  const theme = banner.theme ?? "warm";
  const isTourCta = banner.ctaAction === "open_tour" && banner.ctaLabel;

  const ctaButton =
    banner.ctaLabel &&
    (isTourCta ? (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="bg-white text-foreground hover:bg-white/90 shadow-sm border-0 inline-flex items-center gap-1.5 shrink-0"
        onClick={onTourCta}
      >
        {banner.ctaLabel}
        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
      </Button>
    ) : banner.href ? (
      <Button
        asChild
        size="sm"
        variant="secondary"
        className="bg-white text-foreground hover:bg-white/90 shadow-sm border-0 inline-flex items-center gap-1.5 shrink-0"
      >
        <Link to={banner.href}>
          {banner.ctaLabel}
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
        </Link>
      </Button>
    ) : null);

  return (
    <div
      className={cn(
        "relative w-full min-h-[148px] sm:min-h-[160px] overflow-hidden bg-gradient-to-r text-white",
        THEME_STYLES[theme]
      )}
    >
      <div className="relative z-10 flex h-full flex-col justify-center px-5 pt-5 pb-9 sm:px-10 sm:pt-6 sm:pb-10 max-w-7xl mx-auto w-full">
        <Badge
          variant="outline"
          className={cn(
            "w-fit inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5",
            meta.badgeClass
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{meta.label}</span>
        </Badge>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="min-w-0 flex-1 space-y-2 text-left">
            <h2 className="text-lg font-bold leading-snug sm:text-xl">{banner.title}</h2>
            <p className="text-sm text-white/90 leading-relaxed max-w-3xl">{banner.description}</p>
          </div>
          {ctaButton ? <div className="flex shrink-0 sm:pb-0.5">{ctaButton}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function DashboardBannerCarousel({ enabled = true }: { enabled?: boolean }) {
  const { banners, loading } = useDashboardBanners(enabled);
  const { openLauncher } = useProductTour();
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setSelected(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api, onSelect]);

  useEffect(() => {
    if (!api || banners.length <= 1) return;
    const timer = window.setInterval(() => {
      if (api.canScrollNext()) api.scrollNext();
      else api.scrollTo(0);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [api, banners.length]);

  if (loading) {
    return (
      <div className="flex h-[148px] w-full items-center justify-center border-b border-border bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (banners.length === 0) return null;

  const showNav = banners.length > 1;

  return (
    <section
      className="group/banner relative w-full border-b border-border"
      aria-label="News and offers"
      data-tour="dashboard-banner-carousel"
    >
      <Carousel setApi={setApi} opts={{ loop: showNav, align: "start" }} className="w-full">
        <CarouselContent className="-ml-0">
          {banners.map((banner) => (
            <CarouselItem key={banner.id} className="pl-0 basis-full">
              <BannerSlide banner={banner} onTourCta={openLauncher} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {showNav && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "absolute left-2 top-1/2 z-20 h-9 w-9 -translate-y-1/2 rounded-none",
              "bg-black/30 text-white border-0 hover:bg-black/50 hover:text-white",
              "opacity-0 pointer-events-none transition-opacity duration-200",
              "group-hover/banner:opacity-100 group-hover/banner:pointer-events-auto",
              "focus-visible:opacity-100 focus-visible:pointer-events-auto"
            )}
            onClick={() => api?.scrollPrev()}
            aria-label="Previous banner"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "absolute right-2 top-1/2 z-20 h-9 w-9 -translate-y-1/2 rounded-none",
              "bg-black/30 text-white border-0 hover:bg-black/50 hover:text-white",
              "opacity-0 pointer-events-none transition-opacity duration-200",
              "group-hover/banner:opacity-100 group-hover/banner:pointer-events-auto",
              "focus-visible:opacity-100 focus-visible:pointer-events-auto"
            )}
            onClick={() => api?.scrollNext()}
            aria-label="Next banner"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          <div
            className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5"
            aria-hidden
          >
            {banners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                className={cn(
                  "h-1 transition-all",
                  index === selected ? "w-7 bg-white" : "w-1.5 bg-white/45 hover:bg-white/70"
                )}
                onClick={() => api?.scrollTo(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
