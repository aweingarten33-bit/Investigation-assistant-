import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, a render-time crash anywhere below unmounts the whole React
// tree and leaves only the page's background color visible — a blank grey
// screen with no clue what happened, to the user or to anyone debugging it
// after the fact. This catches that and shows the actual error instead.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-background neu-raised overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-border flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <h1 className="text-base font-bold text-foreground">Something went wrong</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The app hit an unexpected error while rendering. Screenshot this and send it over.
                </p>
              </div>
            </div>
            <div className="px-5 py-4">
              <pre className="text-xs text-foreground/90 bg-muted/40 border border-border rounded-md p-3 whitespace-pre-wrap break-words">
                {this.state.error.message || String(this.state.error)}
              </pre>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 w-full flex items-center justify-center gap-1.5 h-10 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
