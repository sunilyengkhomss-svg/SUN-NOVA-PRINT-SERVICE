import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message:
        error instanceof Error
          ? error.message
          : "An unexpected display error occurred.",
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h1 className="text-lg font-bold text-slate-900">
              SUN-NOVA PRINT SERVICE
            </h1>
            <p className="text-sm text-slate-600">
              The studio encountered a browser error while loading:
            </p>
            <p className="text-xs font-mono bg-slate-100 text-red-700 rounded-lg p-3 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);

(window as Window & { __SUN_NOVA_MOUNTED__?: boolean }).__SUN_NOVA_MOUNTED__ = true;
