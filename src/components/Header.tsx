import { useState } from "react";
import { Mail, Menu, X } from "lucide-react";
import { BRAND_NAME } from "../types/photo";

interface HeaderProps {
  onMailQuery: () => void;
}

const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#services", label: "Services" },
  { href: "#studio-workbench", label: "Studio" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#about", label: "About Us" },
  { href: "#contact", label: "Contact" },
];

export function Header({ onMailQuery }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#080B12]/75 backdrop-blur-xl border-b border-[#00E5FF]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        <a
          href="#home"
          className="text-sm sm:text-base font-extrabold tracking-wide text-[#F5F7FA] whitespace-nowrap shrink-0 hover:text-[#00E5FF] transition-colors"
        >
          {BRAND_NAME}
        </a>

        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-6 text-xs xl:text-sm font-medium text-[#94A3B8]"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-[#00E5FF] hover:underline underline-offset-8 decoration-[#00E5FF]/60 transition-colors whitespace-nowrap shrink-0"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <a
            href="#quote"
            className="hidden sm:inline-flex items-center justify-center bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(0,229,255,0.22)] hover:brightness-110 transition-all whitespace-nowrap shrink-0"
          >
            Get a Quote
          </a>

          <button
            type="button"
            onClick={onMailQuery}
            aria-label="Send Query on Mail"
            className="inline-flex items-center gap-1.5 bg-[#161D2B] hover:bg-[#1E273B] text-[#F5F7FA] border border-[#00E5FF]/25 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
            <span className="hidden md:inline">Mail Desk</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="lg:hidden p-2 rounded-lg bg-[#161D2B] border border-[#00E5FF]/20 text-[#F5F7FA] hover:border-[#00E5FF]/50 transition-colors cursor-pointer"
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
        <div className="lg:hidden border-t border-[#00E5FF]/15 bg-[#080B12]/95 backdrop-blur-xl px-4 py-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-lg bg-[#161D2B]/80 border border-[#00E5FF]/15 text-sm font-medium text-[#F5F7FA] hover:border-[#00E5FF]/45 hover:text-[#00E5FF] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          <a
            href="#quote"
            onClick={() => setMobileOpen(false)}
            className="mt-2 w-full flex items-center justify-center bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-sm font-bold py-2.5 rounded-lg"
          >
            Get a Quote
          </a>
        </div>
      )}
    </header>
  );
}
