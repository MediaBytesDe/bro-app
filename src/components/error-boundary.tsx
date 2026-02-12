"use client";

import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">
            Etwas ist schiefgelaufen
          </h2>
          <p className="text-neutral-400 text-sm mb-4 max-w-md">
            {this.state.error?.message || "Ein unerwarteter Fehler ist aufgetreten."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#fa432a] text-white rounded-lg hover:bg-[#e03d26] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Seite neu laden
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
