import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Compass, Sparkles, X } from "lucide-react";

interface TourWelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartOverview: () => void;
  onPickModule: () => void;
  onDismiss: () => void;
}

export function TourWelcomeDialog({
  open,
  onOpenChange,
  onStartOverview,
  onPickModule,
  onDismiss,
}: TourWelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg gradient-warm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <DialogTitle>Welcome to Banaoo</DialogTitle>
          </div>
          <DialogDescription>
            Take a quick interactive tour to learn how to take orders, manage your menu, and run
            the kitchen — or explore on your own and come back anytime from the info icon.
          </DialogDescription>
        </DialogHeader>

        <ul className="text-sm text-muted-foreground space-y-2 py-2">
          <li className="flex items-start gap-2">
            <Compass className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <span>Hands-on highlights on the actual screens you will use during service.</span>
          </li>
          <li className="flex items-start gap-2">
            <Compass className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <span>Pick a module — Dashboard, Orders, Menu, or Kitchen — at your own pace.</span>
          </li>
        </ul>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button className="w-full gradient-warm text-white border-0" onClick={onStartOverview}>
            Start quick overview
          </Button>
          <Button variant="secondary" className="w-full" onClick={onPickModule}>
            Choose a module
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onDismiss}
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Explore on my own
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
