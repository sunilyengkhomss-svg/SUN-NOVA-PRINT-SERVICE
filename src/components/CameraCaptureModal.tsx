import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  FlipHorizontal2,
  RefreshCw,
  RotateCw,
  Smartphone,
  Timer,
  Upload,
  X,
} from "lucide-react";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => void;
}

type CameraFacing = "user" | "environment";

interface CameraErrorInfo {
  title: string;
  detail: string;
  hint: string;
  kind: "permission" | "not_found" | "in_use" | "unsupported" | "generic";
}

function classifyCameraError(err: unknown): CameraErrorInfo {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return {
      title: "HTTPS Required for Live Camera",
      detail: "Browsers only allow live webcam access on secure HTTPS connections.",
      hint: "Use Open Device Camera below to capture a photo directly.",
      kind: "unsupported",
    };
  }

  const domErr = err as { name?: string; message?: string } | null;
  const name = domErr?.name || "";
  const msg = (domErr?.message || "").toLowerCase();

  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError" ||
    msg.includes("permission denied") ||
    msg.includes("permission dismissed") ||
    msg.includes("not allowed")
  ) {
    const isIframe =
      typeof window !== "undefined" && window.self !== window.top;
    return {
      title: "Camera Permission Denied",
      detail: isIframe
        ? "Live camera access was blocked by the browser or embedded preview frame."
        : "Browser camera access is currently blocked for this site.",
      hint: isIframe
        ? "Tap Open Device Camera below to snap a photo immediately, or allow Camera in your browser site settings and tap Retry Live Camera."
        : "Tap the lock/site icon in your browser address bar, set Camera to Allow, then tap Retry Live Camera — or use Open Device Camera below.",
      kind: "permission",
    };
  }

  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    msg.includes("requested device not found") ||
    msg.includes("no camera")
  ) {
    return {
      title: "No Camera Detected",
      detail: "We could not find an active camera connected to this device.",
      hint: "Connect a webcam and tap Retry Live Camera, or upload a photo from your device.",
      kind: "not_found",
    };
  }

  if (
    name === "NotReadableError" ||
    name === "TrackStartError" ||
    name === "AbortError"
  ) {
    return {
      title: "Camera Busy in Another App",
      detail: "Another app or browser tab is currently using your camera.",
      hint: "Close other video/camera apps and tap Retry Live Camera, or use Open Device Camera below.",
      kind: "in_use",
    };
  }

  if (msg.includes("not supported")) {
    return {
      title: "Live Camera Not Supported",
      detail: "This browser does not expose live webcam streaming.",
      hint: "Tap Open Device Camera below to capture using your phone or computer camera.",
      kind: "unsupported",
    };
  }

  return {
    title: "Camera Unavailable",
    detail:
      domErr?.message ||
      "Could not start the live camera stream on this device.",
    hint: "Tap Retry Live Camera or use Open Device Camera below to capture right away.",
    kind: "generic",
  };
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestIdRef = useRef(0);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<CameraFacing>("user");
  const [mirror, setMirror] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<CameraErrorInfo | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCountdown(null);
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreamReady(false);
  }, []);

  const startCamera = useCallback(
    async (targetFacing: CameraFacing) => {
      const reqId = ++requestIdRef.current;
      clearTimer();
      stopStream();
      setIsStarting(true);
      setCameraError(null);

      try {
        if (typeof window !== "undefined" && !window.isSecureContext) {
          throw new Error("HTTPS required");
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera access is not supported in this browser.");
        }

        const constraintAttempts: MediaStreamConstraints[] = [
          {
            video: {
              facingMode: { ideal: targetFacing },
              width: { ideal: 1280 },
              height: { ideal: 960 },
            },
            audio: false,
          },
          {
            video: { facingMode: targetFacing },
            audio: false,
          },
          {
            video: true,
            audio: false,
          },
        ];

        let stream: MediaStream | null = null;
        let lastErr: unknown = null;

        for (let i = 0; i < constraintAttempts.length; i += 1) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(
              constraintAttempts[i]
            );
            break;
          } catch (attemptErr) {
            lastErr = attemptErr;
            const errName = (attemptErr as { name?: string })?.name || "";
            // Do not re-prompt multiple times if user/browser explicitly denied permission
            if (
              errName === "NotAllowedError" ||
              errName === "PermissionDeniedError" ||
              errName === "SecurityError"
            ) {
              throw attemptErr;
            }
          }
        }

        if (!stream) {
          throw lastErr || new Error("Could not open camera stream.");
        }

        if (reqId !== requestIdRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.srcObject = stream;
          await videoEl.play().catch(() => {});
          if (reqId === requestIdRef.current && videoEl.videoWidth > 0) {
            setIsStreamReady(true);
          }
        }
      } catch (err) {
        if (reqId === requestIdRef.current) {
          setCameraError(classifyCameraError(err));
        }
      } finally {
        if (reqId === requestIdRef.current) {
          setIsStarting(false);
        }
      }
    },
    [clearTimer, stopStream]
  );

  // Start/stop camera when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      requestIdRef.current += 1;
      clearTimer();
      stopStream();
      setCameraError(null);
      setIsStarting(false);
      return;
    }

    startCamera(facingMode);

    return () => {
      requestIdRef.current += 1;
      clearTimer();
      stopStream();
    };
    // Intentionally trigger on open/close; camera switches call startCamera directly in user gesture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-recover immediately if user flips browser camera permission to "Allow" while modal is open
  useEffect(() => {
    if (!isOpen || typeof navigator === "undefined" || !navigator.permissions) {
      return;
    }
    let permStatus: PermissionStatus | null = null;
    let handlePermChange: (() => void) | null = null;
    let active = true;

    navigator.permissions
      .query({ name: "camera" as PermissionName })
      .then((status) => {
        if (!active) return;
        permStatus = status;
        handlePermChange = () => {
          if (active && status.state === "granted") {
            startCamera(facingMode);
          }
        };
        status.addEventListener("change", handlePermChange);
      })
      .catch(() => {
        // Permissions API for camera is unsupported on Safari/Firefox; ignore cleanly
      });

    return () => {
      active = false;
      if (permStatus && handlePermChange) {
        permStatus.removeEventListener("change", handlePermChange);
      }
    };
  }, [isOpen, facingMode, startCamera]);

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleSwitchCamera = () => {
    const nextFacing: CameraFacing =
      facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
    setMirror(nextFacing === "user");
    startCamera(nextFacing);
  };

  const handleNativeFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCameraError({
        title: "Unsupported File",
        detail: "Please capture or choose a valid JPG, PNG, or WEBP photo.",
        hint: "Try Open Device Camera again.",
        kind: "generic",
      });
      return;
    }
    clearTimer();
    stopStream();
    onCapture(file);
    onClose();
  };

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 180);

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
          clearTimer();
          stopStream();
          onCapture(blob);
          onClose();
        }
      },
      "image/jpeg",
      0.95
    );
  }, [clearTimer, mirror, onCapture, onClose, stopStream]);

  const handleTimerCapture = () => {
    if (countdown !== null || !isStreamReady || cameraError) return;
    let remaining = 3;
    setCountdown(remaining);
    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearTimer();
        captureFrame();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  };

  if (!isOpen) return null;

  const canShootLive = isStreamReady && !cameraError && !isStarting && countdown === null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#080B12]/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Click Passport Photo"
    >
      {/* Hidden native camera & photo picker inputs (work reliably even when WebRTC getUserMedia is blocked) */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture={facingMode}
        onChange={handleNativeFilePicked}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleNativeFilePicked}
        className="hidden"
      />

      <div className="bg-[#111827]/95 rounded-[20px] border border-[#00E5FF]/25 shadow-[0_16px_48px_rgba(0,0,0,0.65)] max-w-2xl w-full max-h-[94dvh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-[#00E5FF]/15 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Camera className="w-4 h-4 text-[#00E5FF] shrink-0" />
            <h3 className="text-sm font-bold text-[#F5F7FA] truncate">
              Click Passport Photo (Live Camera)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            className="p-1.5 text-[#94A3B8] hover:text-[#F5F7FA] rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Stage */}
        <div className="relative bg-[#060911] aspect-[4/3] w-full flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="text-center px-5 py-6 max-w-md space-y-3.5 overflow-y-auto max-h-full">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/35 text-amber-300 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-[#F5F7FA]">
                  {cameraError.title}
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {cameraError.detail}
                </p>
                <p className="text-[11px] text-[#94A3B8] leading-relaxed pt-0.5">
                  {cameraError.hint}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#080B12] bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] hover:brightness-110 rounded-lg transition-all cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Open Device Camera</span>
                </button>

                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#F5F7FA] bg-[#161D2B] border border-[#00E5FF]/35 hover:border-[#00E5FF] rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>Retry Live Camera</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#CBD5E1] bg-[#0B101B] border border-white/15 hover:border-[#00E5FF]/40 rounded-lg transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>Upload Photo</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => setIsStreamReady(true)}
                onPlaying={() => setIsStreamReady(true)}
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
                  stroke="rgba(0, 229, 255, 0.85)"
                  strokeWidth="0.6"
                  strokeDasharray="2 2"
                />
                <path
                  d="M25,95 C28,72 38,68 50,68 C62,68 72,72 75,95"
                  fill="none"
                  stroke="rgba(0, 229, 255, 0.55)"
                  strokeWidth="0.5"
                  strokeDasharray="2 2"
                />
              </svg>

              {isStarting && (
                <div className="absolute inset-0 bg-[#080B12]/70 flex flex-col items-center justify-center gap-2 text-xs font-medium text-white">
                  <span>Starting live camera...</span>
                  <span className="text-[11px] text-[#94A3B8]">
                    Allow camera access when prompted
                  </span>
                </div>
              )}

              {countdown !== null && (
                <div className="absolute inset-0 bg-[#080B12]/45 flex items-center justify-center">
                  <span className="text-6xl font-extrabold text-white font-mono-nums drop-shadow">
                    {countdown}
                  </span>
                </div>
              )}

              {shutterFlash && (
                <div className="pointer-events-none absolute inset-0 bg-white/80 transition-opacity" />
              )}
            </>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="px-4 sm:px-5 py-3.5 bg-[#111827] border-t border-[#00E5FF]/15 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSwitchCamera}
              disabled={isStarting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#E2E8F0] bg-[#161D2B] border border-[#00E5FF]/15 hover:border-[#00E5FF]/40 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>
                Switch Camera ({facingMode === "user" ? "Front" : "Rear"})
              </span>
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

          <div className="flex flex-wrap items-center gap-2">
            {cameraError ? (
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-[#080B12] bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] hover:brightness-110 rounded-lg transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Use Device Camera</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!canShootLive}
                  onClick={handleTimerCapture}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#F5F7FA] bg-[#161D2B] border border-[#00E5FF]/20 hover:border-[#00E5FF]/50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Timer className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>{countdown !== null ? `${countdown}s...` : "3s Timer"}</span>
                </button>

                <button
                  type="button"
                  disabled={!canShootLive}
                  onClick={captureFrame}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-[#080B12] bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] hover:brightness-110 disabled:opacity-40 rounded-lg transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Click Photo</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
