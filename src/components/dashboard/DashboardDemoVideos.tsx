import { useState } from "react";
import {
  DEMO_VIDEO_DESCRIPTION,
  DEMO_VIDEO_PLACEHOLDER_LABEL,
  DEMO_VIDEO_TITLE,
  DEMO_VIDEO_YOUTUBE_ID,
} from "@/content/demo-videos";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2, Play, Video } from "lucide-react";

const hasYoutubeVideo = Boolean(DEMO_VIDEO_YOUTUBE_ID?.trim());

function DemoVideoPlayer({ autoplay }: { autoplay?: boolean }) {
  if (hasYoutubeVideo) {
    const params = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      rel: "0",
      modestbranding: "1",
    });
    return (
      <iframe
        title={DEMO_VIDEO_TITLE}
        className="absolute inset-0 h-full w-full border-0"
        src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_YOUTUBE_ID}?${params}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
        <Play className="h-6 w-6 text-white/90 ml-0.5" />
      </div>
      <p className="text-xs font-medium">{DEMO_VIDEO_PLACEHOLDER_LABEL}</p>
    </div>
  );
}

export function DashboardDemoVideos() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setExpanded(false);
  };

  return (
    <>
      <section className="space-y-2" data-tour="dashboard-demo-videos">
        <div className="flex items-center gap-2 px-1">
          <Video className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Videos</h3>
        </div>

        <button type="button" onClick={() => setOpen(true)} className="w-full text-left group">
          <Card className="overflow-hidden shadow-none border-primary/20 transition-all hover:border-primary/40 hover:shadow-sm">
            <div className="relative aspect-video w-full bg-muted overflow-hidden">
              {hasYoutubeVideo ? (
                <img
                  src={`https://img.youtube.com/vi/${DEMO_VIDEO_YOUTUBE_ID}/hqdefault.jpg`}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/35 transition-colors">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/25 group-hover:scale-105 transition-transform">
                  <Play className="h-5 w-5 fill-current ml-0.5" />
                </div>
              </div>
            </div>
            <div className="p-3 space-y-0.5">
              <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                {DEMO_VIDEO_TITLE}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {hasYoutubeVideo ? DEMO_VIDEO_DESCRIPTION : DEMO_VIDEO_PLACEHOLDER_LABEL}
              </p>
              <span className="inline-block text-xs font-medium text-primary pt-1">Watch video →</span>
            </div>
          </Card>
        </button>
      </section>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn(
            "gap-0 p-0 overflow-hidden",
            expanded
              ? "max-w-[96vw] w-[96vw] max-h-[96vh] h-auto translate-y-[-50%]"
              : "max-w-3xl w-[calc(100%-2rem)]"
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3 pr-12">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle>{DEMO_VIDEO_TITLE}</DialogTitle>
              <DialogDescription>{DEMO_VIDEO_DESCRIPTION}</DialogDescription>
            </DialogHeader>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-12 top-3 h-8 w-8 shrink-0"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Exit expanded view" : "Expand video"}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>

          <div
            className={cn(
              "relative w-full bg-black",
              expanded ? "aspect-auto h-[min(78vh,720px)]" : "aspect-video"
            )}
          >
            <DemoVideoPlayer autoplay={open} />
          </div>

          {!hasYoutubeVideo && (
            <p className="text-xs text-muted-foreground px-4 py-3 border-t bg-muted/30">
              Placeholder preview — connect your YouTube link in{" "}
              <span className="font-mono">src/content/demo-videos.ts</span> when ready.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
