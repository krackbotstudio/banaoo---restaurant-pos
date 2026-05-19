import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    this.setState({ error: null });
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background text-foreground">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div className="max-w-md text-center space-y-2">
            <h1 className="text-xl font-semibold font-display">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The page could not load. This is often fixed by refreshing. If it keeps happening on
              Settings → Printers, try clearing site data for this app.
            </p>
            {import.meta.env.DEV ? (
              <p className="text-xs text-destructive/80 font-mono break-all">{this.state.error.message}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.handleHome}>
              Go to dashboard
            </Button>
            <Button onClick={this.handleReload}>Reload page</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
