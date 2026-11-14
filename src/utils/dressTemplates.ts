import { DressStyleId } from "../types/photo";

/**
 * Generates high-detail, studio-grade vector SVG formal outfits for passport photos
 * in a 100x100 coordinate space where the collar sits naturally at y=63..72
 * and shoulders extend cleanly past the edges so scaling/nudging leaves zero gaps.
 */
export function buildDressSvgString(dressId: DressStyleId): string | null {
  if (dressId === "none") return null;

  let body = "";

  switch (dressId) {
    case "student_white_tie":
      body = `
        <defs>
          <linearGradient id="stShirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="65%" stop-color="#f1f5f9"/>
            <stop offset="100%" stop-color="#dbeafe"/>
          </linearGradient>
          <linearGradient id="stTie" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1e3a8a"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
          <pattern id="stStripe" width="6" height="6" patternTransform="rotate(35)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#1e3a8a"/>
            <line x1="0" y1="0" x2="0" y2="6" stroke="#f59e0b" stroke-width="1.3"/>
            <line x1="3" y1="0" x2="3" y2="6" stroke="#ffffff" stroke-width="0.6"/>
          </pattern>
        </defs>
        <!-- Crisp White School/College Shirt -->
        <path d="M36,66 C24,70 10,74 3,84 L-5,108 L105,108 L97,84 C90,74 76,70 64,66 L50,71 Z" fill="url(#stShirt)" stroke="#cbd5e1" stroke-width="0.6"/>
        <!-- Shoulder Seam Shadows -->
        <path d="M35,68 C24,72 13,76 6,84" fill="none" stroke="#cbd5e1" stroke-width="0.6"/>
        <path d="M65,68 C76,72 87,76 94,84" fill="none" stroke="#cbd5e1" stroke-width="0.6"/>
        <!-- Pocket & School Crest -->
        <path d="M68,85 L81,85 L81,98 C81,100.5 74.5,102 74.5,102 C74.5,102 68,100.5 68,98 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.45"/>
        <circle cx="74.5" cy="92" r="2.8" fill="#1e3a8a" stroke="#f59e0b" stroke-width="0.5"/>
        <!-- Striped Student Tie -->
        <polygon points="47.5,73 52.5,73 54.5,100 50,106 45.5,100" fill="url(#stStripe)" stroke="#0f172a" stroke-width="0.35"/>
        <polygon points="46.2,69.2 53.8,69.2 52.2,74.2 47.8,74.2" fill="url(#stTie)" stroke="#0f172a" stroke-width="0.35"/>
        <!-- Structured Shirt Collars -->
        <polygon points="36.2,65.2 49,70.5 43.2,77.5 33.8,71.5" fill="#ffffff" stroke="#94a3b8" stroke-width="0.55"/>
        <polygon points="63.8,65.2 51,70.5 56.8,77.5 66.2,71.5" fill="#ffffff" stroke="#94a3b8" stroke-width="0.55"/>
      `;
      break;

    case "student_navy_uniform":
      body = `
        <defs>
          <linearGradient id="stNavy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1e3a8a"/>
            <stop offset="55%" stop-color="#172554"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
          <pattern id="crestTie" width="5" height="5" patternTransform="rotate(-35)" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="#991b1b"/>
            <line x1="0" y1="0" x2="0" y2="5" stroke="#fcd34d" stroke-width="1"/>
          </pattern>
        </defs>
        <!-- Crisp White Shirt Inner V -->
        <polygon points="35,66 65,66 56,105 44,105" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5"/>
        <!-- Striped Tie -->
        <polygon points="47.5,73 52.5,73 54,100 50,106 46,100" fill="url(#crestTie)" stroke="#450a0a" stroke-width="0.3"/>
        <polygon points="46.2,69.2 53.8,69.2 52.2,74.2 47.8,74.2" fill="#7f1d1d"/>
        <!-- White Collar -->
        <polygon points="36.5,65.5 48.2,70.5 43.5,76.8 34.5,71" fill="#ffffff" stroke="#94a3b8" stroke-width="0.5"/>
        <polygon points="63.5,65.5 51.8,70.5 56.5,76.8 65.5,71" fill="#ffffff" stroke="#94a3b8" stroke-width="0.5"/>
        <!-- Student Navy Blazer -->
        <path d="M36,66 C24,70 10,74 3,84 L-5,108 L49,108 L36,66 Z" fill="url(#stNavy)"/>
        <path d="M64,66 C76,70 90,74 97,84 L105,108 L51,108 L64,66 Z" fill="url(#stNavy)"/>
        <!-- Blazer Lapels with Gold Piping Accent -->
        <polygon points="36,66 32,76 37,79 34,83 49,106 41,80" fill="#1e40af" stroke="#0f172a" stroke-width="0.45"/>
        <polygon points="64,66 68,76 63,79 66,83 51,106 59,80" fill="#1e40af" stroke="#0f172a" stroke-width="0.45"/>
        <!-- School Crest Badge on Left Chest -->
        <path d="M68,85 L77,85 L77,92.5 C77,95.5 72.5,97.5 72.5,97.5 C72.5,97.5 68,95.5 68,92.5 Z" fill="#fbbf24" stroke="#78350f" stroke-width="0.5"/>
        <path d="M69.3,86.5 L75.7,86.5 L75.7,92 C75.7,94 72.5,95.5 72.5,95.5 C72.5,95.5 69.3,94 69.3,92 Z" fill="#1e3a8a"/>
      `;
      break;

    case "student_graduation":
      body = `
        <defs>
          <linearGradient id="gownGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#27272a"/>
            <stop offset="100%" stop-color="#09090b"/>
          </linearGradient>
          <linearGradient id="stoleGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fbbf24"/>
            <stop offset="50%" stop-color="#d97706"/>
            <stop offset="100%" stop-color="#b45309"/>
          </linearGradient>
        </defs>
        <!-- White Collar Shirt underneath -->
        <polygon points="38,66 62,66 56,105 44,105" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.5"/>
        <!-- Academic Gown Body -->
        <path d="M36,66 C23,70 9,75 2,86 L-5,108 L105,108 L98,86 C91,75 77,70 64,66 L50,82 Z" fill="url(#gownGrad)"/>
        <!-- Satin Graduation Stole -->
        <path d="M35,66 L41,66 L49,108 L40,108 Z" fill="url(#stoleGold)" stroke="#78350f" stroke-width="0.4"/>
        <path d="M65,66 L59,66 L51,108 L60,108 Z" fill="url(#stoleGold)" stroke="#78350f" stroke-width="0.4"/>
        <!-- Crimson Hood Trim -->
        <path d="M37,66 C42,78 58,78 63,66 L60,72 C55,81 45,81 40,72 Z" fill="#991b1b" stroke="#450a0a" stroke-width="0.4"/>
      `;
      break;

    case "officer_khaki":
      body = `
        <defs>
          <linearGradient id="khakiGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#c2a36b"/>
            <stop offset="55%" stop-color="#a6864e"/>
            <stop offset="100%" stop-color="#8b6d3b"/>
          </linearGradient>
          <linearGradient id="khakiDark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#967741"/>
            <stop offset="100%" stop-color="#755a2d"/>
          </linearGradient>
          <linearGradient id="brassBtn" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fde68a"/>
            <stop offset="100%" stop-color="#b45309"/>
          </linearGradient>
        </defs>
        <!-- Khaki Uniform Shirt Base -->
        <path d="M36,66 C24,70 10,74 3,84 L-5,108 L105,108 L97,84 C90,74 76,70 64,66 L50,71 Z" fill="url(#khakiGrad)" stroke="#755a2d" stroke-width="0.6"/>
        <!-- Center Placket & Brass Buttons -->
        <rect x="48.2" y="71" width="3.6" height="37" fill="#9c7e47" stroke="#6b5127" stroke-width="0.35"/>
        <circle cx="50" cy="78" r="1.4" fill="url(#brassBtn)" stroke="#78350f" stroke-width="0.3"/>
        <circle cx="50" cy="87.5" r="1.4" fill="url(#brassBtn)" stroke="#78350f" stroke-width="0.3"/>
        <circle cx="50" cy="97" r="1.4" fill="url(#brassBtn)" stroke="#78350f" stroke-width="0.3"/>
        <!-- Shoulder Epaulets -->
        <polygon points="10,80 34,68 36,72 13,84" fill="url(#khakiDark)" stroke="#5c4520" stroke-width="0.45"/>
        <polygon points="90,80 66,68 64,72 87,84" fill="url(#khakiDark)" stroke="#5c4520" stroke-width="0.45"/>
        <circle cx="31.5" cy="71.5" r="1.1" fill="url(#brassBtn)"/>
        <circle cx="68.5" cy="71.5" r="1.1" fill="url(#brassBtn)"/>
        <!-- Officer Chest Pockets with Flaps -->
        <path d="M18,86 L37,86 L37,101 L18,101 Z" fill="#b39359" stroke="#6b5127" stroke-width="0.4"/>
        <polygon points="17.5,86 37.5,86 37.5,90.5 27.5,93 17.5,90.5" fill="url(#khakiDark)" stroke="#5c4520" stroke-width="0.4"/>
        <circle cx="27.5" cy="89.5" r="1.1" fill="url(#brassBtn)"/>
        <path d="M63,86 L82,86 L82,101 L63,101 Z" fill="#b39359" stroke="#6b5127" stroke-width="0.4"/>
        <polygon points="62.5,86 82.5,86 82.5,90.5 72.5,93 62.5,90.5" fill="url(#khakiDark)" stroke="#5c4520" stroke-width="0.4"/>
        <circle cx="72.5" cy="89.5" r="1.1" fill="url(#brassBtn)"/>
        <!-- Officer Whistle Lanyard -->
        <path d="M31,72 C32,81 29,87 27.5,88" fill="none" stroke="#1e293b" stroke-width="0.9"/>
        <!-- Structured Uniform Collars -->
        <polygon points="36.2,65.2 49,70.5 43.2,77.5 33.8,71.5" fill="url(#khakiGrad)" stroke="#5c4520" stroke-width="0.55"/>
        <polygon points="63.8,65.2 51,70.5 56.8,77.5 66.2,71.5" fill="url(#khakiGrad)" stroke="#5c4520" stroke-width="0.55"/>
      `;
      break;

    case "officer_ias_suit":
      body = `
        <defs>
          <linearGradient id="iasCharcoal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#334155"/>
            <stop offset="60%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
          <linearGradient id="iasTie" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0f766e"/>
            <stop offset="100%" stop-color="#134e4a"/>
          </linearGradient>
        </defs>
        <polygon points="35,66 65,66 56,105 44,105" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5"/>
        <!-- Silk Diagonal Tie -->
        <polygon points="47.4,73 52.6,73 54.4,100 50,106 45.6,100" fill="url(#iasTie)"/>
        <polygon points="46.2,69.2 53.8,69.2 52.2,74.2 47.8,74.2" fill="#115e59"/>
        <!-- Crisp Collar -->
        <polygon points="36.4,65.2 48.2,70.5 43.5,76.8 34.4,71" fill="#ffffff" stroke="#94a3b8" stroke-width="0.5"/>
        <polygon points="63.6,65.2 51.8,70.5 56.5,76.8 65.6,71" fill="#ffffff" stroke="#94a3b8" stroke-width="0.5"/>
        <!-- Charcoal Suit Jacket -->
        <path d="M36,66 C24,70 10,74 3,84 L-5,108 L49,108 L36,66 Z" fill="url(#iasCharcoal)"/>
        <path d="M64,66 C76,70 90,74 97,84 L105,108 L51,108 L64,66 Z" fill="url(#iasCharcoal)"/>
        <!-- Sharp Executive Lapels & Emblem Pin -->
        <polygon points="36,66 31.8,76 37,79.2 34,83 49,106 41,80" fill="#475569" stroke="#0f172a" stroke-width="0.45"/>
        <polygon points="64,66 68.2,76 63,79.2 66,83 51,106 59,80" fill="#475569" stroke="#0f172a" stroke-width="0.45"/>
        <circle cx="64.5" cy="84" r="1.3" fill="#fbbf24" stroke="#78350f" stroke-width="0.3"/>
      `;
      break;

    case "officer_defence_navy":
      body = `
        <defs>
          <linearGradient id="defWhite" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="70%" stop-color="#f1f5f9"/>
            <stop offset="100%" stop-color="#cbd5e1"/>
          </linearGradient>
          <linearGradient id="goldBoard" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#1e293b"/>
          </linearGradient>
        </defs>
        <!-- Crisp White Tunic -->
        <path d="M36,66 C24,70 10,74 3,84 L-5,108 L105,108 L97,84 C90,74 76,70 64,66 L50,69 Z" fill="url(#defWhite)" stroke="#94a3b8" stroke-width="0.6"/>
        <!-- High Ceremonial Mandarin Collar -->
        <path d="M36.2,63.2 C42,66.8 58,66.8 63.8,63.2 L64.5,69.5 C58,72.5 42,72.5 35.5,69.5 Z" fill="#ffffff" stroke="#94a3b8" stroke-width="0.55"/>
        <!-- Center Placket & Gold Buttons -->
        <line x1="50" y1="71" x2="50" y2="108" stroke="#94a3b8" stroke-width="0.7"/>
        <circle cx="50" cy="78" r="1.4" fill="#fbbf24" stroke="#92400e" stroke-width="0.35"/>
        <circle cx="50" cy="87.5" r="1.4" fill="#fbbf24" stroke="#92400e" stroke-width="0.35"/>
        <circle cx="50" cy="97" r="1.4" fill="#fbbf24" stroke="#92400e" stroke-width="0.35"/>
        <!-- Shoulder Boards with Gold Stripes -->
        <polygon points="9,80 34,68 36,72.5 13,84.5" fill="url(#goldBoard)"/>
        <line x1="17" y1="76.5" x2="19.5" y2="81" stroke="#fbbf24" stroke-width="1.2"/>
        <line x1="20.5" y1="74.8" x2="23" y2="79.3" stroke="#fbbf24" stroke-width="1.2"/>
        <polygon points="91,80 66,68 64,72.5 87,84.5" fill="url(#goldBoard)"/>
        <line x1="83" y1="76.5" x2="80.5" y2="81" stroke="#fbbf24" stroke-width="1.2"/>
        <line x1="79.5" y1="74.8" x2="77" y2="79.3" stroke="#fbbf24" stroke-width="1.2"/>
      `;
      break;

    case "officer_doctor_coat":
      body = `
        <defs>
          <linearGradient id="docShirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#e0f2fe"/>
            <stop offset="100%" stop-color="#bae6fd"/>
          </linearGradient>
          <linearGradient id="docCoat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#e2e8f0"/>
          </linearGradient>
        </defs>
        <!-- Light Blue Formal Shirt & Navy Tie inside -->
        <polygon points="35,66 65,66 56,105 44,105" fill="url(#docShirt)" stroke="#94a3b8" stroke-width="0.5"/>
        <polygon points="47.5,73 52.5,73 54,100 50,106 46,100" fill="#1e3a8a"/>
        <polygon points="46.5,69.5 53.5,69.5 52,74 48,74" fill="#172554"/>
        <polygon points="36.5,65.5 48,70.5 43.5,76.8 34.5,71" fill="#e0f2fe" stroke="#94a3b8" stroke-width="0.45"/>
        <polygon points="63.5,65.5 52,70.5 56.5,76.8 65.5,71" fill="#e0f2fe" stroke="#94a3b8" stroke-width="0.45"/>
        <!-- White Medical Lab Coat -->
        <path d="M36,66 C24,70 10,74 3,84 L-5,108 L49,108 L36,66 Z" fill="url(#docCoat)" stroke="#cbd5e1" stroke-width="0.6"/>
        <path d="M64,66 C76,70 90,74 97,84 L105,108 L51,108 L64,66 Z" fill="url(#docCoat)" stroke="#cbd5e1" stroke-width="0.6"/>
        <!-- Lab Coat Lapels -->
        <polygon points="36,66 32,76 37,79 34,83 49,106 41,80" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.45"/>
        <polygon points="64,66 68,76 63,79 66,83 51,106 59,80" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.45"/>
        <!-- Medical Stethoscope Tubing over Collar -->
        <path d="M33,67.5 C26,76 26,88 31,96" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M67,67.5 C74,76 74,88 69,96" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="31" cy="96" r="2.2" fill="#94a3b8" stroke="#1e293b" stroke-width="0.6"/>
      `;
      break;

    case "black_suit_tie":
      body = `
        <defs>
          <linearGradient id="suitGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#27272a"/>
            <stop offset="60%" stop-color="#18181b"/>
            <stop offset="100%" stop-color="#09090b"/>
          </linearGradient>
          <linearGradient id="lapelGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#3f3f46"/>
            <stop offset="100%" stop-color="#18181b"/>
          </linearGradient>
          <linearGradient id="tieGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#b91c1c"/>
            <stop offset="100%" stop-color="#450a0a"/>
          </linearGradient>
        </defs>
        <polygon points="35,66 65,66 56,105 44,105" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.5"/>
        <polygon points="47.5,73 52.5,73 54,99 50,105 46,99" fill="url(#tieGrad)"/>
        <polygon points="46.5,69.5 53.5,69.5 52,74 48,74" fill="#7f1d1d"/>
        <polygon points="36.5,65.5 48,70.5 43.5,76.5 34.5,71" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5"/>
        <polygon points="63.5,65.5 52,70.5 56.5,76.5 65.5,71" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5"/>
        <path d="M36,66 C25,70 11,74 4,84 L-4,108 L49,108 L36,66 Z" fill="url(#suitGrad)"/>
        <path d="M64,66 C75,70 89,74 96,84 L104,108 L51,108 L64,66 Z" fill="url(#suitGrad)"/>
        <polygon points="36,66 32,76 37,79 34,83 49,106 41,80" fill="url(#lapelGrad)" stroke="#09090b" stroke-width="0.4"/>
        <polygon points="64,66 68,76 63,79 66,83 51,106 59,80" fill="url(#lapelGrad)" stroke="#09090b" stroke-width="0.4"/>
      `;
      break;

    case "navy_blazer_white":
      body = `
        <defs>
          <linearGradient id="navyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1e3a5f"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
          <linearGradient id="navyLapel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#284b7a"/>
            <stop offset="100%" stop-color="#172554"/>
          </linearGradient>
          <linearGradient id="blueTie" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1d4ed8"/>
            <stop offset="100%" stop-color="#1e3a8a"/>
          </linearGradient>
        </defs>
        <polygon points="35,66 65,66 56,105 44,105" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5"/>
        <polygon points="47.5,73 52.5,73 54,99 50,105 46,99" fill="url(#blueTie)"/>
        <polygon points="46.5,69.5 53.5,69.5 52,74 48,74" fill="#1e40af"/>
        <polygon points="36.5,65.5 48,70.5 43.5,76.5 34.5,71" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5"/>
        <polygon points="63.5,65.5 52,70.5 56.5,76.5 65.5,71" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5"/>
        <path d="M36,66 C25,70 11,74 4,84 L-4,108 L49,108 L36,66 Z" fill="url(#navyGrad)"/>
        <path d="M64,66 C75,70 89,74 96,84 L104,108 L51,108 L64,66 Z" fill="url(#navyGrad)"/>
        <polygon points="36,66 32,76 37,79 34,83 49,106 41,80" fill="url(#navyLapel)" stroke="#0f172a" stroke-width="0.4"/>
        <polygon points="64,66 68,76 63,79 66,83 51,106 59,80" fill="url(#navyLapel)" stroke="#0f172a" stroke-width="0.4"/>
      `;
      break;

    case "white_formal_shirt":
      body = `
        <defs>
          <linearGradient id="shirtGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#e2e8f0"/>
          </linearGradient>
        </defs>
        <path d="M36,66 C25,70 11,74 4,84 L-4,108 L104,108 L96,84 C89,74 75,70 64,66 L50,71 Z" fill="url(#shirtGrad)" stroke="#cbd5e1" stroke-width="0.6"/>
        <rect x="48.5" y="71" width="3" height="36" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.35"/>
        <circle cx="50" cy="77" r="1.1" fill="#94a3b8"/>
        <circle cx="50" cy="86" r="1.1" fill="#94a3b8"/>
        <circle cx="50" cy="95" r="1.1" fill="#94a3b8"/>
        <polygon points="36.5,65.5 49.5,71.5 43,78 33.5,72" fill="#ffffff" stroke="#94a3b8" stroke-width="0.55"/>
        <polygon points="63.5,65.5 50.5,71.5 57,78 66.5,72" fill="#ffffff" stroke="#94a3b8" stroke-width="0.55"/>
      `;
      break;

    case "womens_black_blazer":
      body = `
        <defs>
          <linearGradient id="wBlackGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#27272a"/>
            <stop offset="100%" stop-color="#09090b"/>
          </linearGradient>
        </defs>
        <path d="M37,68 C43,75 57,75 63,68 L60,106 L40,106 Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.5"/>
        <path d="M37,67 C26,70 13,75 6,85 L-2,108 L46,108 L37,67 Z" fill="url(#wBlackGrad)"/>
        <path d="M63,67 C74,70 87,75 94,85 L102,108 L54,108 L63,67 Z" fill="url(#wBlackGrad)"/>
        <polygon points="37,67 33,77 38,81 46,106 42,79" fill="#3f3f46" stroke="#18181b" stroke-width="0.4"/>
        <polygon points="63,67 67,77 62,81 54,106 58,79" fill="#3f3f46" stroke="#18181b" stroke-width="0.4"/>
      `;
      break;

    case "womens_navy_blazer":
      body = `
        <defs>
          <linearGradient id="wNavyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1e3a5f"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <path d="M37,68 L63,68 L60,106 L40,106 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5"/>
        <polygon points="37,66.5 49,73 43.5,79 34.5,72.5" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5"/>
        <polygon points="63,66.5 51,73 56.5,79 65.5,72.5" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.5"/>
        <path d="M37,67 C26,70 13,75 6,85 L-2,108 L47,108 L37,67 Z" fill="url(#wNavyGrad)"/>
        <path d="M63,67 C74,70 87,75 94,85 L102,108 L53,108 L63,67 Z" fill="url(#wNavyGrad)"/>
        <polygon points="37,67 33,77 38,81 47,106 42,79" fill="#284b7a" stroke="#0f172a" stroke-width="0.4"/>
        <polygon points="63,67 67,77 62,81 53,106 58,79" fill="#284b7a" stroke="#0f172a" stroke-width="0.4"/>
      `;
      break;

    case "nehru_jacket":
      body = `
        <defs>
          <linearGradient id="nehruGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#334155"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <path d="M37,66 C25,70 11,74 4,84 L-4,108 L104,108 L96,84 C89,74 75,70 63,66 L50,70 Z" fill="url(#nehruGrad)"/>
        <path d="M36.5,63.5 C42,67 58,67 63.5,63.5 L64.5,69.5 C58,72.5 42,72.5 35.5,69.5 Z" fill="#1e293b" stroke="#475569" stroke-width="0.5"/>
        <line x1="50" y1="71" x2="50" y2="108" stroke="#0f172a" stroke-width="0.8"/>
        <circle cx="50" cy="77" r="1.2" fill="#cbd5e1"/>
        <circle cx="50" cy="86" r="1.2" fill="#cbd5e1"/>
        <circle cx="50" cy="95" r="1.2" fill="#cbd5e1"/>
      `;
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${body}</svg>`;
}

export function buildDressDataUrl(dressId: DressStyleId): string | null {
  const svg = buildDressSvgString(dressId);
  if (!svg) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
