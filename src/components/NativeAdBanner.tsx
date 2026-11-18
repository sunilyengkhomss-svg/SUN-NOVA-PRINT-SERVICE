import React, { useCallback, useEffect, useRef, useState } from "react";

const NATIVE_AD_KEY = "c8e48542a24efae7940c0370449ec792";
const NATIVE_AD_SCRIPT_SRC = `https://bauval.org/21/${NATIVE_AD_KEY}`;
const NATIVE_AD_CONTAINER_ID = `container-${NATIVE_AD_KEY}`;
const SOCIAL_BAR_SCRIPT_SRC = "https://bauval.org/14/91f316c59160dd5b1191da8db7f14a02";

export const BANNER_UNITS = {
  banner728x90: {
    key: "60bbc8d2f81aeb2d0c36ac3eebecbe96",
    width: 728,
    height: 90,
    label: "728×90 Leaderboard",
  },
  banner468x60: {
    key: "4046ff4d18776f6c8f49964ae4bc7049",
    width: 468,
    height: 60,
    label: "468×60 Banner",
  },
  banner320x50: {
    key: "c15f3724981ebf13a3fe2550926d56bc",
    width: 320,
    height: 50,
    label: "320×50 Mobile Banner",
  },
  banner300x250: {
    key: "81128a9cc888bc771afe1598f3e17b70",
    width: 300,
    height: 250,
    label: "300×250 Medium Rectangle",
  },
  banner160x300: {
    key: "e3ffe5d025823a9aca4aa8416bf4fa1b",
    width: 160,
    height: 300,
    label: "160×300 Skyscraper",
  },
  banner160x600: {
    key: "cd962511c1f1d17fb539cf3c6fdc9f1e",
    width: 160,
    height: 600,
    label: "160×600 Wide Skyscraper",
  },
} as const;

declare global {
  interface Window {
    atOptions?: {
      key: string;
      format: string;
      height: number;
      width: number;
      params: Record<string, unknown>;
    };
  }
}

// Serialize atOptions banner script execution so concurrent slots never overwrite window.atOptions.
let bannerLoadQueue: Promise<void> = Promise.resolve();

function enqueueBannerLoad(task: () => Promise<void>): Promise<void> {
  const next = bannerLoadQueue.then(task, task);
  bannerLoadQueue = next.catch(() => {});
  return next;
}

function detectRenderedCreative(root: HTMLElement | null): boolean {
  if (!root) return false;
  const media = root.querySelector("iframe, img, ins, a, object, embed, video, canvas");
  if (media) {
    const rect = media.getBoundingClientRect();
    if (rect.width >= 16 && rect.height >= 16) return true;
    // Allow freshly inserted iframes that specify explicit attributes before first paint
    if (media.tagName === "IFRAME") {
      const w = Number(media.getAttribute("width") || 0);
      const h = Number(media.getAttribute("height") || 0);
      if (w >= 16 && h >= 16) return true;
    }
  }
  const nonScriptChildren = Array.from(root.children).filter(
    (el) => el.tagName !== "SCRIPT" && el.tagName !== "STYLE"
  );
  for (const child of nonScriptChildren) {
    const rect = child.getBoundingClientRect();
    if (rect.width >= 16 && rect.height >= 16) return true;
    if ((child.textContent || "").trim().length > 0 && child.children.length > 0) {
      return true;
    }
  }
  return false;
}

interface DirectBannerSlotProps {
  adKey: string;
  width: number;
  height: number;
  onFilledChange?: (filled: boolean) => void;
}

const DirectBannerSlot: React.FC<DirectBannerSlotProps> = ({
  adKey,
  width,
  height,
  onFilledChange,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [filled, setFilled] = useState(false);

  const reportFilled = useCallback(
    (value: boolean) => {
      setFilled((prev) => {
        if (prev !== value) {
          onFilledChange?.(value);
        }
        return value;
      });
    },
    [onFilledChange]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let pollTimer: number | null = null;

    const checkCreative = () => {
      if (cancelled) return;
      if (detectRenderedCreative(host)) {
        reportFilled(true);
      }
    };

    const observer = new MutationObserver(() => {
      checkCreative();
    });
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    if (host.dataset.loadedKey !== adKey) {
      enqueueBannerLoad(
        () =>
          new Promise<void>((resolve) => {
            if (!host.isConnected || host.dataset.loadedKey === adKey) {
              resolve();
              return;
            }
            host.dataset.loadedKey = adKey;

            window.atOptions = {
              key: adKey,
              format: "iframe",
              height,
              width,
              params: {},
            };

            const script = document.createElement("script");
            script.type = "text/javascript";
            script.setAttribute("data-cfasync", "false");
            script.setAttribute("data-banner-key", adKey);
            script.src = `https://bauval.org/22/${adKey}`;

            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              checkCreative();
              resolve();
            };

            const safetyTimer = window.setTimeout(finish, 6000);
            script.onload = () => {
              window.clearTimeout(safetyTimer);
              window.setTimeout(finish, 120);
            };
            script.onerror = () => {
              window.clearTimeout(safetyTimer);
              finish();
            };

            host.appendChild(script);
          })
      );
    } else {
      checkCreative();
    }

    // Re-check briefly after mount in case ad script injects iframe asynchronously
    let checks = 0;
    pollTimer = window.setInterval(() => {
      checks += 1;
      checkCreative();
      if (checks >= 20 && pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    }, 400);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
    };
  }, [adKey, height, width, reportFilled]);

  return (
    <div
      className={`max-w-full flex items-center justify-center transition-opacity duration-200 ${
        filled
          ? "opacity-100 overflow-hidden rounded-xl bg-[#080B12]/70 border border-white/5"
          : "opacity-0 max-h-0 overflow-hidden pointer-events-none"
      }`}
      style={{
        width: `${width}px`,
        minHeight: filled ? `${height}px` : "0px",
      }}
    >
      <div
        ref={hostRef}
        className="flex items-center justify-center max-w-full"
        style={{ width: `${width}px` }}
      />
    </div>
  );
};

export const ResponsiveHorizontalBanner: React.FC = () => {
  const [unitKey, setUnitKey] = useState<
    "banner728x90" | "banner468x60" | "banner320x50"
  >(() => {
    if (typeof window === "undefined") return "banner728x90";
    if (window.innerWidth >= 780) return "banner728x90";
    if (window.innerWidth >= 510) return "banner468x60";
    return "banner320x50";
  });
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const updateUnit = () => {
      const next =
        window.innerWidth >= 780
          ? "banner728x90"
          : window.innerWidth >= 510
          ? "banner468x60"
          : "banner320x50";
      setUnitKey((prev) => {
        if (prev !== next) setFilled(false);
        return next;
      });
    };
    updateUnit();
    window.addEventListener("resize", updateUnit);
    return () => window.removeEventListener("resize", updateUnit);
  }, []);

  const unit = BANNER_UNITS[unitKey];

  return (
    <div
      className={
        filled
          ? "max-w-7xl w-full mx-auto px-4 sm:px-6 pt-2 pb-2"
          : "max-w-7xl w-full mx-auto max-h-0 overflow-hidden opacity-0 pointer-events-none"
      }
      aria-hidden={!filled}
    >
      <div
        className={
          filled
            ? "bg-[#0D1322]/70 border border-[#00E5FF]/15 rounded-2xl px-3 py-3 sm:px-5 sm:py-4 flex flex-col items-center justify-center gap-2"
            : "flex flex-col items-center justify-center"
        }
      >
        {filled && (
          <span className="text-[11px] font-medium text-[#94A3B8] self-start">
            Sponsored
          </span>
        )}
        <DirectBannerSlot
          key={unit.key}
          adKey={unit.key}
          width={unit.width}
          height={unit.height}
          onFilledChange={setFilled}
        />
      </div>
    </div>
  );
};

export const SocialBarAd: React.FC = () => {
  useEffect(() => {
    if (document.querySelector('script[data-sunnova-ad="social-bar"]')) return;

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.setAttribute("data-sunnova-ad", "social-bar");
    script.src = SOCIAL_BAR_SCRIPT_SRC;
    script.onerror = () => {
      script.remove();
    };
    document.body.appendChild(script);
  }, []);

  return null;
};

export const NativeAdBanner: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [nativeFilled, setNativeFilled] = useState(false);
  const [rect300Filled, setRect300Filled] = useState(false);

  useEffect(() => {
    const container = document.getElementById(NATIVE_AD_CONTAINER_ID);
    const wrapper = wrapperRef.current;
    if (!container || !wrapper) return;

    let cancelled = false;
    const checkNative = () => {
      if (cancelled) return;
      if (detectRenderedCreative(container)) {
        setNativeFilled(true);
      }
    };

    const observer = new MutationObserver(() => {
      checkNative();
    });
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    if (!document.querySelector('script[data-sunnova-ad="native"]')) {
      const script = document.createElement("script");
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      script.setAttribute("data-sunnova-ad", "native");
      script.src = NATIVE_AD_SCRIPT_SRC;
      script.onload = () => {
        window.setTimeout(checkNative, 150);
      };
      script.onerror = () => {
        script.remove();
      };
      wrapper.appendChild(script);
    } else {
      checkNative();
    }

    let checks = 0;
    const poll = window.setInterval(() => {
      checks += 1;
      checkNative();
      if (checks >= 20) {
        window.clearInterval(poll);
      }
    }, 400);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearInterval(poll);
    };
  }, []);

  const anyVisible = nativeFilled || rect300Filled;

  return (
    <section
      aria-label="Sponsored content"
      aria-hidden={!anyVisible}
      className={
        anyVisible
          ? "max-w-7xl w-full mx-auto px-4 sm:px-6 py-4"
          : "max-w-7xl w-full mx-auto max-h-0 overflow-hidden opacity-0 pointer-events-none"
      }
    >
      <div
        className={
          anyVisible
            ? "grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
            : "w-full"
        }
      >
        <div
          ref={wrapperRef}
          className={
            nativeFilled
              ? `${
                  rect300Filled ? "lg:col-span-8" : "lg:col-span-12"
                } bg-[#0D1322]/70 border border-[#00E5FF]/15 rounded-2xl p-4 sm:p-5 flex flex-col justify-between`
              : "w-full max-h-0 overflow-hidden opacity-0 pointer-events-none"
          }
        >
          {nativeFilled && (
            <div className="flex items-center justify-between gap-4 mb-3">
              <span className="text-[11px] font-medium text-[#94A3B8]">
                Sponsored
              </span>
            </div>
          )}
          <div id={NATIVE_AD_CONTAINER_ID} className="w-full overflow-hidden" />
        </div>

        <div
          className={
            rect300Filled
              ? `${
                  nativeFilled ? "lg:col-span-4" : "lg:col-span-12"
                } bg-[#0D1322]/70 border border-[#00E5FF]/15 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-between`
              : "max-h-0 overflow-hidden opacity-0 pointer-events-none flex justify-center"
          }
        >
          {rect300Filled && (
            <span className="text-[11px] font-medium text-[#94A3B8] self-start mb-3">
              Partner Spotlight
            </span>
          )}
          <DirectBannerSlot
            adKey={BANNER_UNITS.banner300x250.key}
            width={BANNER_UNITS.banner300x250.width}
            height={BANNER_UNITS.banner300x250.height}
            onFilledChange={setRect300Filled}
          />
        </div>
      </div>
    </section>
  );
};

export const LowerBannerShowcase: React.FC = () => {
  const [sky300Filled, setSky300Filled] = useState(false);
  const [sky600Filled, setSky600Filled] = useState(false);
  const anyVisible = sky300Filled || sky600Filled;

  return (
    <section
      aria-label="Partner banners"
      aria-hidden={!anyVisible}
      className={
        anyVisible
          ? "max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6"
          : "max-w-7xl w-full mx-auto max-h-0 overflow-hidden opacity-0 pointer-events-none"
      }
    >
      <div
        className={
          anyVisible
            ? "bg-[#0D1322]/70 border border-[#00E5FF]/15 rounded-2xl p-5 sm:p-6"
            : "w-full"
        }
      >
        {anyVisible && (
          <div className="flex items-center justify-between gap-4 mb-4">
            <span className="text-[11px] font-medium text-[#94A3B8]">
              Featured Partners
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-6">
          <DirectBannerSlot
            adKey={BANNER_UNITS.banner160x300.key}
            width={BANNER_UNITS.banner160x300.width}
            height={BANNER_UNITS.banner160x300.height}
            onFilledChange={setSky300Filled}
          />
          <DirectBannerSlot
            adKey={BANNER_UNITS.banner160x600.key}
            width={BANNER_UNITS.banner160x600.width}
            height={BANNER_UNITS.banner160x600.height}
            onFilledChange={setSky600Filled}
          />
        </div>
      </div>
    </section>
  );
};
