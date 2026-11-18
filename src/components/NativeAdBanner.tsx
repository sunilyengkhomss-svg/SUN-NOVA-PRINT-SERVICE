import React, { useEffect, useRef, useState } from "react";

const NATIVE_AD_KEY = "c8e48542a24efae7940c0370449ec792";
const NATIVE_AD_SCRIPT_SRC = `https://bauval.org/21/${NATIVE_AD_KEY}`;
const NATIVE_AD_CONTAINER_ID = `container-${NATIVE_AD_KEY}`;
const SOCIAL_BAR_SCRIPT_SRC = "https://bauval.org/14/91f316c59160dd5b1191da8db7f14a02";
const POPUNDER_SCRIPT_SRC = "https://abscloud.org/1/6e7404808e766ead3b6741f5c719484c";

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

interface BannerAdFrameProps {
  adKey: string;
  width: number;
  height: number;
  title: string;
}

export const BannerAdFrame: React.FC<BannerAdFrameProps> = ({
  adKey,
  width,
  height,
  title,
}) => {
  const srcDoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <script>
      atOptions = {
        'key' : '${adKey}',
        'format' : 'iframe',
        'height' : ${height},
        'width' : ${width},
        'params' : {}
      };
    </script>
    <script src="https://bauval.org/22/${adKey}"></script>
  </body>
</html>`;

  return (
    <div
      className="max-w-full overflow-hidden flex items-center justify-center rounded-xl bg-[#080B12]/70 border border-white/5"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <iframe
        title={title}
        srcDoc={srcDoc}
        width={width}
        height={height}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="border-0 block max-w-full"
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

  useEffect(() => {
    const updateUnit = () => {
      if (window.innerWidth >= 780) {
        setUnitKey("banner728x90");
      } else if (window.innerWidth >= 510) {
        setUnitKey("banner468x60");
      } else {
        setUnitKey("banner320x50");
      }
    };
    updateUnit();
    window.addEventListener("resize", updateUnit);
    return () => window.removeEventListener("resize", updateUnit);
  }, []);

  const unit = BANNER_UNITS[unitKey];

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-2 pb-2">
      <div className="bg-[#0D1322]/70 border border-[#00E5FF]/15 rounded-2xl px-3 py-3 sm:px-5 sm:py-4 flex flex-col items-center justify-center gap-2">
        <span className="text-[11px] font-medium text-[#94A3B8] self-start">
          Sponsored
        </span>
        <BannerAdFrame
          key={unit.key}
          adKey={unit.key}
          width={unit.width}
          height={unit.height}
          title={unit.label}
        />
      </div>
    </div>
  );
};

export const PopunderAd: React.FC = () => {
  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${POPUNDER_SCRIPT_SRC}"]`
    );
    if (existing) return;

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = POPUNDER_SCRIPT_SRC;
    script.onerror = () => {
      script.remove();
    };
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
};

export const SocialBarAd: React.FC = () => {
  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SOCIAL_BAR_SCRIPT_SRC}"]`
    );
    if (existing) return;

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = SOCIAL_BAR_SCRIPT_SRC;
    script.onerror = () => {
      script.remove();
    };
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
};

export const NativeAdBanner: React.FC = () => {
  const scriptHostRef = useRef<HTMLDivElement>(null);
  const [adUnavailable, setAdUnavailable] = useState(false);

  useEffect(() => {
    const host = scriptHostRef.current;
    const container = document.getElementById(NATIVE_AD_CONTAINER_ID);
    if (!host || !container) return;

    container.innerHTML = "";
    host.innerHTML = "";

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = NATIVE_AD_SCRIPT_SRC;
    script.onerror = () => {
      setAdUnavailable(true);
    };

    host.appendChild(script);

    return () => {
      host.innerHTML = "";
      container.innerHTML = "";
    };
  }, []);

  return (
    <section
      aria-label="Sponsored content"
      className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 space-y-4"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {!adUnavailable && (
          <div className="lg:col-span-8 bg-[#0D1322]/70 border border-[#00E5FF]/15 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4 mb-3">
              <span className="text-[11px] font-medium text-[#94A3B8]">
                Sponsored
              </span>
            </div>
            <div
              id={NATIVE_AD_CONTAINER_ID}
              className="w-full min-h-[120px] overflow-hidden"
            />
            <div ref={scriptHostRef} className="hidden" aria-hidden="true" />
          </div>
        )}

        <div
          className={`${
            adUnavailable ? "lg:col-span-12" : "lg:col-span-4"
          } bg-[#0D1322]/70 border border-[#00E5FF]/15 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-between`}
        >
          <span className="text-[11px] font-medium text-[#94A3B8] self-start mb-3">
            Partner Spotlight
          </span>
          <BannerAdFrame
            adKey={BANNER_UNITS.banner300x250.key}
            width={BANNER_UNITS.banner300x250.width}
            height={BANNER_UNITS.banner300x250.height}
            title={BANNER_UNITS.banner300x250.label}
          />
        </div>
      </div>
    </section>
  );
};

export const LowerBannerShowcase: React.FC = () => {
  return (
    <section
      aria-label="Partner banners"
      className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6"
    >
      <div className="bg-[#0D1322]/70 border border-[#00E5FF]/15 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <span className="text-[11px] font-medium text-[#94A3B8]">
            Featured Partners
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <BannerAdFrame
            adKey={BANNER_UNITS.banner160x300.key}
            width={BANNER_UNITS.banner160x300.width}
            height={BANNER_UNITS.banner160x300.height}
            title={BANNER_UNITS.banner160x300.label}
          />
          <BannerAdFrame
            adKey={BANNER_UNITS.banner160x600.key}
            width={BANNER_UNITS.banner160x600.width}
            height={BANNER_UNITS.banner160x600.height}
            title={BANNER_UNITS.banner160x600.label}
          />
        </div>
      </div>
    </section>
  );
};
