import { useState } from "react";
import { Mail, Menu, X } from "lucide-react";
import { WebsiteSettings } from "../types/cms";
import { BRAND_ICON_URL, BRAND_NAME, OFFICIAL_SUPPORT_EMAIL } from "../types/photo";

interface HeaderProps {
  onMailQuery: () => void;
  cmsSettings?: WebsiteSettings;
}

const DEFAULT_NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#services", label: "Services" },
  { href: "#studio-workbench", label: "Studio" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#about", label: "About Us" },
  { href: "#contact", label: "Contact" },
];

export function Header({ onMailQuery, cmsSettings }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const logoText = cmsSettings?.logoText?.trim() || BRAND_NAME;
  const logoImageUrl = cmsSettings?.logoImageUrl?.trim() || BRAND_ICON_URL;
  const navLinks =
    cmsSettings?.navLinks && cmsSettings.navLinks.length > 0
      ? cmsSettings.navLinks
      : DEFAULT_NAV_LINKS;
  const supportEmail =
    cmsSettings?.contactEmail?.trim() || OFFICIAL_SUPPORT_EMAIL;

  return (
    <header className="sticky top-0 z-40 bg-[#080B12]/80 backdrop-blur-xl border-b border-[#00E5FF]/20">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
        <a
          href="#home"
          className="inline-flex items-center gap-2.5 text-xs sm:text-sm md:text-base font-extrabold tracking-wide text-[#F5F7FA] whitespace-nowrap truncate min-w-0 hover:text-[#00E5FF] transition-colors"
        >
          <img
            src={logoImageUrl}
            alt={logoText}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-[#00E5FF]/35 shadow-[0_0_12px_rgba(0,229,255,0.2)] shrink-0"
          />
          <span className="truncate">{logoText}</span>
        </a>

        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-5 xl:gap-7 text-xs xl:text-sm font-medium text-[#94A3B8] shrink-0"
        >
          {navLinks.map((link) => (
            <a
              key={`${link.href}-${link.label}`}
              href={link.href}
              className="hover:text-[#00E5FF] hover:underline underline-offset-8 decoration-[#00E5FF]/60 transition-colors whitespace-nowrap shrink-0"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <a
            href="#quote"
            className="hidden sm:inline-flex items-center justify-center bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold px-3.5 sm:px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(0,229,255,0.22)] hover:brightness-110 transition-all whitespace-nowrap shrink-0"
          >
            Get a Quote
          </a>

          <button
            type="button"
            onClick={onMailQuery}
            aria-label="Send Query on Mail"
            className="inline-flex items-center gap-1.5 bg-[#161D2B] hover:bg-[#1E273B] text-[#F5F7FA] border border-[#00E5FF]/25 text-xs font-semibold px-2.5 sm:px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[38px]"
          >
            <Mail className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
            <span className="hidden sm:inline">Mail Desk</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#161D2B] border border-[#00E5FF]/20 text-[#F5F7FA] hover:border-[#00E5FF]/50 transition-colors cursor-pointer"
          >
            {mobileOpen ? (
              <X className="w-4 h-4 text-[#00E5FF]" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-[#00E5FF]/15 bg-[#080B12]/95 backdrop-blur-xl px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {navLinks.map((link) => (
              <a
                key={`${link.href}-${link.label}`}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-lg bg-[#161D2B]/80 border border-[#00E5FF]/15 text-sm font-medium text-[#F5F7FA] hover:border-[#00E5FF]/45 hover:text-[#00E5FF] transition-colors text-center sm:text-left"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <a
              href="#quote"
              onClick={() => setMobileOpen(false)}
              className="w-full flex items-center justify-center bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-sm font-bold py-2.5 rounded-lg"
            >
              Get a Quote
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onMailQuery();
              }}
              className="w-full flex items-center justify-center gap-2 bg-[#161D2B] border border-[#00E5FF]/25 text-[#F5F7FA] text-xs font-semibold py-2.5 px-3 rounded-lg cursor-pointer truncate"
            >
              <Mail className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
              <span className="truncate">{supportEmail}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
