import { useState } from "react";
import {
  DEMO_VIDEOS,
  DEMO_VIDEOS_FOLDER_URL,
  DemoVideo,
  driveEmbedUrl,
  driveThumbnailUrl,
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
import { ExternalLink, Maximize2, Minimize2, Play, Video } from "lucide-react";

function DriveVideoPlayer({
  video,
  autoplay,
}: {
  video: DemoVideo;
  autoplay?: boolean;
}) {
  return (
    <iframe
      title={video.title}
      className="absolute inset-0 h-full w-full border-0"
      src={driveEmbedUrl(video.driveFileId, autoplay)}
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}

function VideoCard({
  video,
  onPlay,
}: {
  video: DemoVideo;
  onPlay: () => void;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);

  return (
    <button type="button" onClick={onPlay} className="w-full text-left group">
      <Card className="overflow-hidden shadow-none border-primary/15 transition-all hover:border-primary/40 hover:shadow-sm">
        <div className="relative aspect-video w-full bg-muted overflow-hidden">
          {!thumbFailed ? (
            <img
              src={driveThumbnailUrl(video.driveFileId)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              onError={() => setThumbFailed(true)}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/35 transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/25 group-hover:scale-105 transition-transform">
              <Play className="h-4 w-4 fill-current ml-0.5" />
            </div>
          </div>
        </div>
        <div className="p-2.5 space-y-0.5">
          <p className="text-xs font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {video.title}
          </p>
          <p className="text-[11px] text-muted-foreground line-clamp-2">{video.description}</p>
        </div>
      </Card>
    </button>
  );
}

export function DashboardDemoVideos() {
  const [activeVideo, setActiveVideo] = useState<DemoVideo | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setActiveVideo(null);
      setExpanded(false);
    }
  };

  return (
    <>
      <section className="space-y-2" data-tour="dashboard-demo-videos">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <Video className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Videos
            </h3>
          </div>
          <a
            href={DEMO_VIDEOS_FOLDER_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-primary font-medium inline-flex items-center gap-0.5 shrink-0 hover:underline"
          >
            All
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="max-h-[min(52vh,520px)] overflow-y-auto pr-0.5 space-y-2 scrollbar-thin">
          {DEMO_VIDEOS.map((video) => (
            <VideoCard key={video.id} video={video} onPlay={() => setActiveVideo(video)} />
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground px-1">
          {DEMO_VIDEOS.length} onboarding guides from Google Drive
        </p>
      </section>

      <Dialog open={!!activeVideo} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn(
            "gap-0 p-0 overflow-hidden",
            expanded
              ? "max-w-[96vw] w-[96vw] max-h-[96vh] h-auto translate-y-[-50%]"
              : "max-w-3xl w-[calc(100%-2rem)]"
          )}
        >
          {activeVideo && (
            <>
              <div className="flex items-start justify-between gap-3 border-b px-4 py-3 pr-12">
                <DialogHeader className="text-left space-y-1">
                  <DialogTitle className="text-base leading-snug pr-2">
                    {activeVideo.title}
                  </DialogTitle>
                  <DialogDescription>{activeVideo.description}</DialogDescription>
                </DialogHeader>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute right-12 top-3 h-8 w-8 shrink-0"
                  onClick={() => setExpanded((v) => !v)}
                  aria-label={expanded ? "Exit expanded view" : "Expand video"}
                >
                  {expanded ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div
                className={cn(
                  "relative w-full bg-black",
                  expanded ? "aspect-auto h-[min(78vh,720px)]" : "aspect-video"
                )}
              >
                <DriveVideoPlayer video={activeVideo} autoplay />
              </div>

              <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t bg-muted/30 text-xs text-muted-foreground">
                <span>Hosted on Google Drive</span>
                <a
                  href={`https://drive.google.com/file/d/${activeVideo.driveFileId}/view`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary font-medium inline-flex items-center gap-1 hover:underline"
                >
                  Open in Drive
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
