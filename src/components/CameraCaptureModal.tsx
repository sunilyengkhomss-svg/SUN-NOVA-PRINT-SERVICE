import { useEffect, useRef, useState } from "react";
import { Camera, FlipHorizontal2, RefreshCw, Timer, X } from "lucide-react";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => void;
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [mirror, setMirror] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCountdown(null);
      return;
    }

    let cancelled = false;
    const startCamera = async () => {
      try {
        setIsStarting(true);
        setCameraError(null);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera access is not supported in this browser.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            err instanceof Error
              ? err.message
              : "Could not access camera. Please allow camera permissions and try again."
          );
        }
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode]);

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob);
          onClose();
        }
      },
      "image/jpeg",
      0.95
    );
  };

  const handleTimerCapture = () => {
    if (countdown !== null) return;
    let remaining = 3;
    setCountdown(remaining);
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        setCountdown(null);
        captureFrame();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#080B12]/80 backdrop-blur-md flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Click Passport Photo"
    >
      <div className="bg-[#111827]/95 rounded-[20px] border border-[#00E5FF]/25 shadow-[0_16px_48px_rgba(0,0,0,0.65)] max-w-2xl w-full overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-[#00E5FF]/15 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#00E5FF]" />
            <h3 className="text-sm font-bold text-[#F5F7FA]">
              Click Passport Photo (Live Camera)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            className="p-1.5 text-[#94A3B8] hover:text-[#F5F7FA] rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative bg-slate-900 aspect-[4/3] w-full flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="text-center px-6 max-w-md">
              <p className="text-sm font-semibold text-white mb-1">
                Camera Unavailable
              </p>
              <p className="text-xs text-slate-300">{cameraError}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  mirror ? "-scale-x-100" : ""
                }`}
              />

              {/* Head & Shoulder Alignment Guide */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 w-full h-full"
                aria-hidden="true"
              >
                <ellipse
                  cx="50"
                  cy="40"
                  rx="16"
                  ry="24"
                  fill="none"
                  stroke="rgba(251, 191, 36, 0.85)"
                  strokeWidth="0.6"
                  strokeDasharray="2 2"
                />
                <path
                  d="M25,95 C28,72 38,68 50,68 C62,68 72,72 75,95"
                  fill="none"
                  stroke="rgba(251, 191, 36, 0.55)"
                  strokeWidth="0.5"
                  strokeDasharray="2 2"
                />
              </svg>

              {isStarting && (
                <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center text-xs font-medium text-white">
                  Starting camera...
                </div>
              )}

              {countdown !== null && (
                <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                  <span className="text-6xl font-extrabold text-white font-mono-nums">
                    {countdown}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 bg-[#111827] border-t border-[#00E5FF]/15 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setFacingMode((m) => (m === "user" ? "environment" : "user"))
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#E2E8F0] bg-[#161D2B] border border-[#00E5FF]/15 hover:border-[#00E5FF]/40 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Switch Camera</span>
            </button>
            <button
              type="button"
              onClick={() => setMirror((m) => !m)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                mirror
                  ? "border-[#00E5FF]/50 bg-[#00E5FF]/15 text-[#00E5FF]"
                  : "border-[#00E5FF]/15 text-[#94A3B8] hover:text-[#F5F7FA]"
              }`}
            >
              <FlipHorizontal2 className="w-3.5 h-3.5" />
              <span>Mirror</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={Boolean(cameraError) || countdown !== null}
              onClick={handleTimerCapture}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#F5F7FA] bg-[#161D2B] border border-[#00E5FF]/20 hover:border-[#00E5FF]/50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              <Timer className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>3s Timer</span>
            </button>

            <button
              type="button"
              disabled={Boolean(cameraError) || countdown !== null}
              onClick={captureFrame}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-[#080B12] bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] hover:brightness-110 disabled:opacity-40 rounded-lg transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Click Photo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
