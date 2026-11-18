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
        <div className="min-h-screen bg-[#080B12] text-[#F5F7FA] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#111827] border border-cyan-400/20 rounded-2xl p-6 space-y-4 shadow-[0_24px_64px_rgba(0,0,0,0.65)]">
            <h1 className="text-lg font-bold text-[#00E5FF] tracking-wide">
              SUN-NOVA PRINT SERVICE
            </h1>
            <p className="text-sm text-[#94A3B8]">
              The studio encountered a browser error while loading:
            </p>
            <p className="text-xs font-mono bg-[#080B12] border border-rose-500/30 text-rose-300 rounded-lg p-3 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold text-[#080B12] bg-[#00E5FF] hover:bg-cyan-300 rounded-lg cursor-pointer transition-colors"
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
