import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Bell, Check, ChevronRight, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, AppNotification } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "notifications-panel-open";

type NotificationPanelContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const NotificationPanelContext = createContext<NotificationPanelContextValue | null>(null);

function useNotificationPanel() {
  const context = useContext(NotificationPanelContext);
  if (!context) {
    throw new Error("useNotificationPanel must be used within NotificationPanelProvider");
  }
  return context;
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onNavigate,
}: {
  notification: AppNotification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "subscription":
        return "💳";
      case "payment":
        return "💰";
      case "order":
        return "🍽️";
      case "app_update":
        return "⬆️";
      default:
        return "🔔";
    }
  };

  const getTypeBgColor = (type: string) => {
    switch (type) {
      case "subscription":
        return "bg-primary/10";
      case "payment":
        return "bg-green-500/10";
      case "order":
        return "bg-orange-500/10";
      case "app_update":
        return "bg-blue-500/10";
      default:
        return "bg-muted";
    }
  };

  return (
    <div
      className={cn(
        "p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors",
        !notification.read && "bg-primary/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0",
            getTypeBgColor(notification.type)
          )}
        >
          {getTypeIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "text-sm font-medium truncate",
                !notification.read && "text-primary"
              )}
            >
              {notification.title}
            </p>
            {!notification.read && (
              <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
            })}
          </p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {!notification.read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(notification.id);
              }}
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {notification.action_url && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 mt-2 text-xs"
          onClick={() => onNavigate(notification.action_url!)}
        >
          View details →
        </Button>
      )}
    </div>
  );
}

export function NotificationPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });

  const setOpen = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setOpenState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      window.localStorage.setItem(STORAGE_KEY, String(value));
      return value;
    });
  }, []);

  const toggle = useCallback(() => setOpen((prev) => !prev), [setOpen]);

  useEffect(() => {
    const handleToggle = () => toggle();
    window.addEventListener("notifications-toggle", handleToggle as EventListener);
    return () => window.removeEventListener("notifications-toggle", handleToggle as EventListener);
  }, [toggle]);

  return (
    <NotificationPanelContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </NotificationPanelContext.Provider>
  );
}

export function NotificationTrigger() {
  const { toggle, open } = useNotificationPanel();
  const { unreadCount } = useNotifications();

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return (
    <Button
      variant={open ? "secondary" : "ghost"}
      size="icon"
      className="relative h-8 w-8 md:h-10 md:w-10"
      onClick={toggle}
      aria-label={open ? "Close notifications panel" : "Open notifications panel"}
      aria-expanded={open}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Button>
  );
}

export function NotificationPanel() {
  const navigate = useNavigate();
  const { open, setOpen } = useNotificationPanel();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const handleNavigate = (url: string) => {
    navigate(url);
  };

  return (
    <aside
      className={cn(
        "relative shrink-0 h-full border-l border-border bg-background transition-[width] duration-300 ease-in-out overflow-hidden",
        open ? "w-80 max-w-[85vw]" : "w-0 border-l-0"
      )}
      aria-hidden={!open}
    >
      <div className="flex h-full w-80 max-w-[85vw] flex-col">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setOpen(false)}
              aria-label="Collapse notifications panel"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold text-sm truncate">Notifications</h2>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto text-xs px-2"
                onClick={markAllAsRead}
              >
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOpen(false)}
              aria-label="Close notifications panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </ScrollArea>

        <div className="border-t p-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => navigate("/settings")}
          >
            Manage notification preferences
          </Button>
        </div>
      </div>
    </aside>
  );
}

/** @deprecated Use NotificationTrigger in header and NotificationPanel in layout */
export function NotificationCenter() {
  return <NotificationTrigger />;
}
