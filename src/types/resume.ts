export type ResumeProfessionId =
  | "business"
  | "teacher"
  | "gaming"
  | "sports"
  | "tech"
  | "finance"
  | "healthcare"
  | "sales"
  | "design"
  | "media"
  | "civil"
  | "hospitality"
  | "legal"
  | "student"
  | "custom";

export type ResumeTemplateId =
  | "executive"
  | "sidebar"
  | "academic"
  | "compact"
  | "bold_banner"
  | "split_dark"
  | "timeline"
  | "minimalist"
  | "editorial"
  | "esports_hud"
  | "sports_card"
  | "right_sidebar"
  | "two_tone_frame"
  | "boxed_cards"
  | "monogram"
  | "creative_ribbon";

export type ResumeFontFamily = "sans" | "serif" | "classic";
export type ResumePaperSize = "a4" | "letter";

export type ResumePhotoShape =
  | "rounded"
  | "circle"
  | "square"
  | "squircle"
  | "oval"
  | "hexagon"
  | "octagon"
  | "diamond";

export type ResumePhotoBorderStyle = "solid" | "double" | "dashed" | "none";

export type ResumeSectionKey =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "certifications"
  | "projects"
  | "languages"
  | "declaration";

export interface ResumeExperienceItem {
  id: string;
  role: string;
  organization: string;
  location: string;
  period: string;
  bullets: string;
}

export interface ResumeEducationItem {
  id: string;
  degree: string;
  institution: string;
  year: string;
  grade: string;
}

export interface ResumeCertificationItem {
  id: string;
  title: string;
  issuer: string;
  year: string;
}

export interface ResumeProjectItem {
  id: string;
  title: string;
  subtitle: string;
  details: string;
}

export interface ResumeData {
  professionId: ResumeProfessionId;
  template: ResumeTemplateId;
  accentColor: string;
  fontFamily: ResumeFontFamily;
  paperSize: ResumePaperSize;
  fontScale: number; // 0.86 to 1.12

  // Customizable line & section spacing
  lineGapScale: number; // 0.8 to 1.5
  sectionGapScale: number; // 0.65 to 1.6
  itemGapScale: number; // 0.65 to 1.6

  // Photo customization
  showPhoto: boolean;
  photoUrl: string | null;
  photoShape: ResumePhotoShape;
  photoBorderStyle: ResumePhotoBorderStyle;
  photoBorderWidth: number; // 0 to 12 px
  photoSizeScale: number; // 0.75 to 1.3

  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  website: string;

  summary: string;
  experience: ResumeExperienceItem[];
  education: ResumeEducationItem[];
  skills: string[];
  certifications: ResumeCertificationItem[];
  projects: ResumeProjectItem[];
  languages: string;
  declarationText: string;
  declarationPlace: string;

  sectionOrder: ResumeSectionKey[];
  visibleSections: Record<ResumeSectionKey, boolean>;
  sectionTitles: Record<ResumeSectionKey, string>;
}

export const RESUME_ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: "Executive Navy", hex: "#101F3C" },
  { name: "Royal Blue", hex: "#1D4ED8" },
  { name: "Educator Emerald", hex: "#065F46" },
  { name: "Crimson Burgundy", hex: "#7F1D1D" },
  { name: "Charcoal Slate", hex: "#1E293B" },
  { name: "Warm Amber", hex: "#B45309" },
  { name: "Electric Cyan", hex: "#0284C7" },
  { name: "Neon Violet", hex: "#6D28D9" },
  { name: "Deep Indigo", hex: "#312E81" },
  { name: "Teal Studio", hex: "#0F766E" },
  { name: "Coral Flame", hex: "#C2410C" },
  { name: "Rosewood Ruby", hex: "#9F1239" },
  { name: "Forest Pine", hex: "#14532D" },
  { name: "Midnight Onyx", hex: "#090D16" },
  { name: "Plum Velvet", hex: "#581C87" },
  { name: "Bronze Gold", hex: "#92400E" },
  { name: "Esports Cobalt", hex: "#2563EB" },
  { name: "Athletic Red", hex: "#B91C1C" },
];

export const RESUME_TEMPLATES: {
  id: ResumeTemplateId;
  label: string;
  description: string;
}[] = [
  {
    id: "executive",
    label: "Executive Classic",
    description: "Top stripe & clean single-column hierarchy",
  },
  {
    id: "sidebar",
    label: "Modern Left Sidebar",
    description: "Tinted left info panel with main career column",
  },
  {
    id: "right_sidebar",
    label: "Modern Right Sidebar",
    description: "Main career left column with right skills sidebar",
  },
  {
    id: "split_dark",
    label: "Obsidian Dark Sidebar",
    description: "High-contrast dark left column with bright white text",
  },
  {
    id: "bold_banner",
    label: "Bold Full Banner",
    description: "Full-width colored masthead with standout title",
  },
  {
    id: "academic",
    label: "Teacher & Academic CV",
    description: "Centered masthead with shaded section headings",
  },
  {
    id: "compact",
    label: "ATS Compact",
    description: "High-density 1-page recruiter format",
  },
  {
    id: "esports_hud",
    label: "Pro Gaming & Esports HUD",
    description: "Corner bracket masthead & arena stat tags",
  },
  {
    id: "sports_card",
    label: "Athletic & Sports Profile",
    description: "Diagonal athletic stripe & bold championship header",
  },
  {
    id: "timeline",
    label: "Career Timeline",
    description: "Vertical milestone rail connecting experience entries",
  },
  {
    id: "minimalist",
    label: "Swiss Minimalist",
    description: "Clean open whitespace with ultra-crisp typography",
  },
  {
    id: "editorial",
    label: "Editorial Magazine",
    description: "Vertical accent spine & boxed executive summary",
  },
  {
    id: "two_tone_frame",
    label: "Dual-Tone Frame",
    description: "Precision page perimeter border & framed masthead",
  },
  {
    id: "boxed_cards",
    label: "Modular Card Blocks",
    description: "Subtle tinted cards separating experience & projects",
  },
  {
    id: "monogram",
    label: "Studio Monogram Crest",
    description: "Circular initial emblem alongside classic typography",
  },
  {
    id: "creative_ribbon",
    label: "Creative Studio Ribbon",
    description: "Geometric corner accent & pill competency tags",
  },
];

export const RESUME_PHOTO_SHAPES: {
  id: ResumePhotoShape;
  label: string;
}[] = [
  { id: "rounded", label: "Rounded" },
  { id: "circle", label: "Circle" },
  { id: "square", label: "Square" },
  { id: "squircle", label: "Squircle" },
  { id: "oval", label: "Portrait Oval" },
  { id: "hexagon", label: "Hexagon" },
  { id: "octagon", label: "Octagon" },
  { id: "diamond", label: "Diamond" },
];

export const DEFAULT_SECTION_ORDER: ResumeSectionKey[] = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "languages",
  "declaration",
];

export const DEFAULT_SECTION_TITLES: Record<ResumeSectionKey, string> = {
  summary: "Professional Summary",
  experience: "Work Experience",
  education: "Education",
  skills: "Core Skills & Competencies",
  projects: "Key Projects & Initiatives",
  certifications: "Certifications & Credentials",
  languages: "Languages",
  declaration: "Declaration",
};

export interface ProfessionPresetMeta {
  id: ResumeProfessionId;
  label: string;
  shortLabel: string;
  recommendedTemplate: ResumeTemplateId;
  recommendedAccent: string;
  buildData: () => ResumeData;
}

const baseVisibility = (
  overrides?: Partial<Record<ResumeSectionKey, boolean>>
): Record<ResumeSectionKey, boolean> => ({
  summary: true,
  experience: true,
  education: true,
  skills: true,
  projects: true,
  certifications: true,
  languages: true,
  declaration: false,
  ...overrides,
});

const baseStyleDefaults = () => ({
  lineGapScale: 1,
  sectionGapScale: 1,
  itemGapScale: 1,
  photoBorderStyle: "solid" as ResumePhotoBorderStyle,
  photoBorderWidth: 5,
  photoSizeScale: 1,
});

export function normalizeResumeData(raw: Partial<ResumeData>): ResumeData {
  const base = createResumePreset(raw.professionId || "custom");
  return {
    ...base,
    ...raw,
    lineGapScale:
      typeof raw.lineGapScale === "number" ? raw.lineGapScale : 1,
    sectionGapScale:
      typeof raw.sectionGapScale === "number" ? raw.sectionGapScale : 1,
    itemGapScale:
      typeof raw.itemGapScale === "number" ? raw.itemGapScale : 1,
    photoBorderStyle: raw.photoBorderStyle || "solid",
    photoBorderWidth:
      typeof raw.photoBorderWidth === "number" ? raw.photoBorderWidth : 5,
    photoSizeScale:
      typeof raw.photoSizeScale === "number" ? raw.photoSizeScale : 1,
    visibleSections: {
      ...base.visibleSections,
      ...(raw.visibleSections || {}),
    },
    sectionTitles: {
      ...base.sectionTitles,
      ...(raw.sectionTitles || {}),
    },
    sectionOrder:
      Array.isArray(raw.sectionOrder) && raw.sectionOrder.length > 0
        ? raw.sectionOrder
        : [...DEFAULT_SECTION_ORDER],
  };
}

export const PROFESSION_PRESETS: ProfessionPresetMeta[] = [
  {
    id: "business",
    label: "Business & Management",
    shortLabel: "Business",
    recommendedTemplate: "executive",
    recommendedAccent: "#101F3C",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "business",
      template: "executive",
      accentColor: "#101F3C",
      fontFamily: "sans",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: true,
      photoUrl: null,
      photoShape: "rounded",
      fullName: "Aarav Mehta",
      jobTitle: "Business Operations & Growth Manager",
      email: "aarav.mehta@example.com",
      phone: "",
      location: "Bengaluru, Karnataka",
      website: "linkedin.com/in/aaravmehta",
      summary:
        "Results-driven Business Operations Manager with 6+ years of experience scaling commercial workflows, leading cross-functional teams of 25+, and improving quarterly profit margins through data-backed process optimization and strategic vendor partnerships.",
      experience: [
        {
          id: "exp-b1",
          role: "Senior Business Operations Manager",
          organization: "Meridian Commercial Solutions Pvt. Ltd.",
          location: "Bengaluru",
          period: "2022 – Present",
          bullets:
            "• Directed daily regional operations across 4 branch offices generating ₹18 Cr annual revenue.\n• Reduced procurement & fulfillment turnaround time by 28% through standardized SOPs and inventory forecasting.\n• Negotiated key enterprise vendor contracts saving ₹42 Lakh annually while maintaining 99.2% SLA compliance.",
        },
        {
          id: "exp-b2",
          role: "Business Development & Operations Lead",
          organization: "Northstar Retail Ventures",
          location: "Pune",
          period: "2019 – 2022",
          bullets:
            "• Expanded B2B distributor network from 35 to 90+ active partners across Western India.\n• Built weekly KPI dashboards tracking customer acquisition cost, retention, and regional margin performance.\n• Trained and mentored a 14-member client onboarding and account management team.",
        },
      ],
      education: [
        {
          id: "edu-b1",
          degree: "MBA — Operations & Business Strategy",
          institution: "Symbiosis Institute of Business Management",
          year: "2017 – 2019",
          grade: "CGPA 8.7 / 10",
        },
        {
          id: "edu-b2",
          degree: "Bachelor of Business Administration (BBA)",
          institution: "University of Pune",
          year: "2014 – 2017",
          grade: "First Class with Distinction",
        },
      ],
      skills: [
        "Operations Strategy",
        "P&L Management",
        "Vendor Negotiation",
        "Business Analytics",
        "CRM & ERP Systems",
        "Team Leadership",
        "Budget Forecasting",
        "Process Improvement",
      ],
      projects: [
        {
          id: "proj-b1",
          title: "Regional Supply Chain Digitization",
          subtitle: "2023 · Pan-India Rollout",
          details:
            "Replaced manual branch reporting with unified cloud order tracking across 4 warehouses, cutting order errors by 40%.",
        },
      ],
      certifications: [
        {
          id: "cert-b1",
          title: "Lean Six Sigma Green Belt",
          issuer: "KPMG India",
          year: "2023",
        },
        {
          id: "cert-b2",
          title: "Project Management Professional (PMP) Prep",
          issuer: "PMI",
          year: "2021",
        },
      ],
      languages: "English (Fluent), Hindi (Native), Marathi (Conversational)",
      declarationText:
        "I hereby declare that all details furnished above are true and accurate to the best of my knowledge.",
      declarationPlace: "Bengaluru",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: true, declaration: false }),
      sectionTitles: {
        ...DEFAULT_SECTION_TITLES,
        projects: "Key Business Initiatives",
      },
    }),
  },
  {
    id: "gaming",
    label: "Game & Esports Resume",
    shortLabel: "Game & Esports",
    recommendedTemplate: "esports_hud",
    recommendedAccent: "#6D28D9",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "gaming",
      template: "esports_hud",
      accentColor: "#6D28D9",
      fontFamily: "sans",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: true,
      photoUrl: null,
      photoShape: "hexagon",
      fullName: "Vikram 'Vortex' Singh",
      jobTitle: "Esports Athlete (IGL) & Unreal Engine Game Designer",
      email: "vikram.vortex.gg@example.com",
      phone: "",
      location: "Mumbai, Maharashtra",
      website: "twitch.tv/vortexgg · artstation.com/vortex",
      summary:
        "Competitive Tactical FPS In-Game Leader (IGL) and Unity/Unreal Game Developer with 4+ years of LAN/online tournament podium finishes and 3 published indie titles. Combines real-time comms leadership, opponent VOD analysis, and gameplay mechanics scripting.",
      experience: [
        {
          id: "exp-g1",
          role: "Team Captain & In-Game Leader (Valiant Arena Roster)",
          organization: "NovaStrike Esports Club",
          location: "Mumbai",
          period: "2023 – Present",
          bullets:
            "• Led 5-player varsity & pro roster to Top-4 finish at National Esports Masters 2025 (₹6 Lakh prize pool).\n• Designed map execute playbooks, scrim schedules, and post-match VOD review systems lifting win-rate from 54% to 73%.\n• Coordinated sponsor activations and 18+ hours/week livestream showcase events.",
        },
        {
          id: "exp-g2",
          role: "Junior Gameplay Programmer & Level Designer",
          organization: "PixelForge Indie Interactive",
          location: "Bengaluru",
          period: "2021 – 2023",
          bullets:
            "• Prototyped combat loops, AI wave spawners, and HUD telemetry in Unity (C#) & Unreal Engine 5 Blueprints.\n• Optimized draw calls and shader LODs to lock steady 120 FPS on mid-range PCs.",
        },
      ],
      education: [
        {
          id: "edu-g1",
          degree: "B.Sc. in Game Design & Interactive Media",
          institution: "Arena Animation & University Program",
          year: "2018 – 2021",
          grade: "First Class · 8.6 CGPA",
        },
      ],
      skills: [
        "Team Strategy & IGL Comms",
        "Unity (C#) & Unreal Engine 5",
        "Level & Combat Design",
        "Tournament VOD Analytics",
        "Blender 3D & Shaders",
        "Frame-Rate Profiling (120Hz)",
        "OBS Studio & Broadcast Production",
        "Clutch Aim & Scrim Coaching",
      ],
      projects: [
        {
          id: "proj-g1",
          title: "Neon Drift Circuit — Indie Arcade Racer",
          subtitle: "48,000+ Steam Wishlists · Lead Dev",
          details:
            "Built arcade drift physics, split-screen multiplayer, and custom synth-reactive UI menus in 9 months.",
        },
        {
          id: "proj-g2",
          title: "Tournament Achievement Highlights",
          subtitle: "2023 – 2026 Competitive Record",
          details:
            "1st Place Campus Arena Championship (2024) · MVP Award Southern Invitational LAN · Ranked Immortal / Radiant Peak.",
        },
      ],
      certifications: [
        {
          id: "cert-g1",
          title: "Unity Certified User: Programmer",
          issuer: "Unity Technologies",
          year: "2023",
        },
        {
          id: "cert-g2",
          title: "Esports Coaching & Integrity Certification",
          issuer: "ESFI / Global Esports",
          year: "2024",
        },
      ],
      languages: "English (Fluent), Hindi (Native), Punjabi",
      declarationText:
        "I confirm that all tournament records, rankings, and shipped game titles listed above are genuine.",
      declarationPlace: "Mumbai",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: true, declaration: false }),
      sectionTitles: {
        ...DEFAULT_SECTION_TITLES,
        summary: "Player & Creator Profile",
        experience: "Esports Teams & Game Studio History",
        projects: "Shipped Games & Tournament Honors",
        certifications: "Engine Badges & Esports Credentials",
      },
    }),
  },
  {
    id: "sports",
    label: "Sports Athlete & Coach",
    shortLabel: "Sports & Coach",
    recommendedTemplate: "sports_card",
    recommendedAccent: "#B91C1C",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "sports",
      template: "sports_card",
      accentColor: "#B91C1C",
      fontFamily: "sans",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: true,
      photoUrl: null,
      photoShape: "octagon",
      fullName: "Arjun Singh Chauhan",
      jobTitle: "National Track Athlete & Certified Athletics Coach",
      email: "arjun.sports.coach@example.com",
      phone: "",
      location: "Chandigarh, Punjab",
      website: "",
      summary:
        "Disciplined National-level Track & Field Athlete and NIS-certified Athletic Coach with 6+ years of competitive tournament experience and youth academy conditioning. Proven track record designing strength programs, injury-prevention warmups, and winning district and state relay squads.",
      experience: [
        {
          id: "exp-sp1",
          role: "Head Athletics & Conditioning Coach",
          organization: "North Zone Sports Academy",
          location: "Chandigarh",
          period: "2022 – Present",
          bullets:
            "• Coached U-19 boys and girls sprint squads yielding 14 State Championship medals across 100m, 200m, and 4×100m relays.\n• Built structured periodized strength, VO2 max, and plyometric agility blocks tailored to each athlete.\n• Partnered with sports physiotherapists on hamstring recovery and hydration nutrition charts.",
        },
        {
          id: "exp-sp2",
          role: "Senior Varsity Captain & Competitive Sprinter",
          organization: "Punjab University Athletics Club",
          location: "Patiala / Chandigarh",
          period: "2018 – 2022",
          bullets:
            "• Personal Best: 100m (10.58s) & 200m (21.34s); represented state in 3 consecutive Senior National Meets.\n• Mentored 22 junior hostel athletes in track mechanics, block starts, and match-day focus.",
        },
      ],
      education: [
        {
          id: "edu-sp1",
          degree: "Diploma in Sports Coaching (NIS Patiala)",
          institution: "Netaji Subhas National Institute of Sports",
          year: "2021 – 2022",
          grade: "Distinction · Grade A",
        },
        {
          id: "edu-sp2",
          degree: "Bachelor of Physical Education (B.P.Ed.)",
          institution: "Panjab University",
          year: "2018 – 2021",
          grade: "81% · First Division",
        },
      ],
      skills: [
        "Sprint Mechanics & Relay Strategy",
        "Strength & Conditioning (S&C)",
        "Periodization & Match Fitness",
        "Injury Prevention & Rehab Drills",
        "Sports Nutrition Guidance",
        "Match Scouting & Video Analysis",
        "First Aid & CPR Ready",
        "Youth Academy Leadership",
      ],
      projects: [
        {
          id: "proj-sp1",
          title: "Major Medals & Athletic Records",
          subtitle: "2019 – 2025 Career Stats",
          details:
            "Gold Medal — All India Inter-University 4×100m Relay (2021) · Silver Medal — State Senior Athletics 100m (2022) · Best Coach Award (2024).",
        },
      ],
      certifications: [
        {
          id: "cert-sp1",
          title: "World Athletics Level 1 Coaching Certification",
          issuer: "Athletics Federation of India",
          year: "2023",
        },
        {
          id: "cert-sp2",
          title: "Red Cross Sports First Aid & CPR License",
          issuer: "Indian Red Cross Society",
          year: "2024",
        },
      ],
      languages: "English, Hindi, Punjabi",
      declarationText:
        "I hereby declare that all athletic records, coaching credentials, and medals listed above are accurate.",
      declarationPlace: "Chandigarh",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: true, declaration: true }),
      sectionTitles: {
        ...DEFAULT_SECTION_TITLES,
        summary: "Athletic & Coaching Profile",
        experience: "Coaching & Competitive History",
        projects: "Medals, Personal Bests & Records",
        certifications: "Coaching Licenses & Safety Credentials",
      },
    }),
  },
  {
    id: "teacher",
    label: "Teacher & Educator",
    shortLabel: "Teacher",
    recommendedTemplate: "academic",
    recommendedAccent: "#065F46",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "teacher",
      template: "academic",
      accentColor: "#065F46",
      fontFamily: "serif",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: true,
      photoUrl: null,
      photoShape: "rounded",
      fullName: "Priya Sharma",
      jobTitle: "Senior Secondary Teacher (PGT English & Social Studies)",
      email: "priya.sharma.edu@example.com",
      phone: "",
      location: "New Delhi, India",
      website: "",
      summary:
        "Dedicated CBSE Educator with 7+ years of classroom teaching experience across Grades 6–12. Known for student-centered lesson planning, high board examination pass rates, inclusive pedagogy, and mentoring inter-school debate and academic clubs.",
      experience: [
        {
          id: "exp-t1",
          role: "Post Graduate Teacher (PGT) — English & Humanities",
          organization: "Delhi Public Senior Secondary School",
          location: "New Delhi",
          period: "2021 – Present",
          bullets:
            "• Taught English Core and Literature to Grades 11–12 (180+ students annually) with 100% CBSE pass rate and 38% scoring 90+.\n• Designed interactive NEP-2020 aligned lesson plans, rubric assessments, and remedial learning modules.\n• Coordinated Annual Literary Fest, parent-teacher academic reviews, and NCERT curriculum workshops.",
        },
        {
          id: "exp-t2",
          role: "Trained Graduate Teacher (TGT)",
          organization: "St. Xavier's Convent High School",
          location: "Noida",
          period: "2018 – 2021",
          bullets:
            "• Delivered daily classes for Grades 6–10 using smart-board visual aids and differentiated group activities.\n• Improved class average literacy and writing scores by 22% over three academic terms.\n• Served as Class Coordinator managing student progress reports, attendance, and co-curricular mentoring.",
        },
      ],
      education: [
        {
          id: "edu-t1",
          degree: "Bachelor of Education (B.Ed.)",
          institution: "Jamia Millia Islamia University",
          year: "2016 – 2018",
          grade: "82% · First Division",
        },
        {
          id: "edu-t2",
          degree: "Master of Arts (M.A.) in English Literature",
          institution: "University of Delhi",
          year: "2014 – 2016",
          grade: "First Division",
        },
      ],
      skills: [
        "Lesson Planning (CBSE / NEP)",
        "Classroom Management",
        "Student Assessment & Rubrics",
        "Smart-Board & EdTech Tools",
        "Remedial Coaching",
        "Parent-Teacher Communication",
        "Curriculum Development",
        "Academic Mentoring",
      ],
      projects: [
        {
          id: "proj-t1",
          title: "Subjects Taught & Co-Curricular Roles",
          subtitle: "Grades 6 to 12 · CBSE Board",
          details:
            "English Core, English Literature, Social Science, Creative Writing Club Advisor, and Examination Cell Coordinator.",
        },
      ],
      certifications: [
        {
          id: "cert-t1",
          title: "Central Teacher Eligibility Test (CTET) — Paper I & II Qualified",
          issuer: "CBSE",
          year: "2018",
        },
        {
          id: "cert-t2",
          title: "NEP 2020 Experiential Pedagogy Certificate",
          issuer: "DIKSHA / NCERT",
          year: "2023",
        },
      ],
      languages: "English (Fluent), Hindi (Native)",
      declarationText:
        "I solemnly declare that all academic credentials and teaching experience stated above are true and authentic.",
      declarationPlace: "New Delhi",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: true, declaration: true }),
      sectionTitles: {
        ...DEFAULT_SECTION_TITLES,
        summary: "Teaching Philosophy & Summary",
        experience: "Teaching Experience",
        education: "Academic & Teaching Qualifications",
        projects: "Subjects Taught & School Responsibilities",
        certifications: "Eligibility & Certifications (CTET / B.Ed.)",
      },
    }),
  },
  {
    id: "tech",
    label: "Software & IT Engineer",
    shortLabel: "Tech / IT",
    recommendedTemplate: "sidebar",
    recommendedAccent: "#1D4ED8",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "tech",
      template: "sidebar",
      accentColor: "#1D4ED8",
      fontFamily: "sans",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: false,
      photoUrl: null,
      photoShape: "circle",
      fullName: "Neha Kulkarni",
      jobTitle: "Full-Stack Software Engineer",
      email: "neha.kulkarni.dev@example.com",
      phone: "",
      location: "Hyderabad, Telangana",
      website: "github.com/nehakulkarni",
      summary:
        "Full-Stack Engineer with 4+ years building resilient web platforms in TypeScript, React, Node.js, and PostgreSQL. Focused on clean system architecture, API latency reduction, automated testing, and responsive user interfaces.",
      experience: [
        {
          id: "exp-it1",
          role: "Software Engineer II",
          organization: "CloudGrid Systems",
          location: "Hyderabad",
          period: "2022 – Present",
          bullets:
            "• Architected multi-tenant analytics dashboard serving 45,000+ monthly active users with React and TypeScript.\n• Cut API p95 response latency by 42% using PostgreSQL composite indexes and Redis caching.\n• Mentored 3 junior developers through code reviews and CI/CD test automation.",
        },
        {
          id: "exp-it2",
          role: "Junior Full-Stack Developer",
          organization: "BrightByte Labs",
          location: "Pune",
          period: "2020 – 2022",
          bullets:
            "• Built REST APIs with Express and Node.js integrated with payment webhooks and role-based access control.\n• Reduced frontend bundle size by 30% via route splitting and asset optimization.",
        },
      ],
      education: [
        {
          id: "edu-it1",
          degree: "B.Tech in Computer Science & Engineering",
          institution: "NIT Nagpur",
          year: "2016 – 2020",
          grade: "CGPA 8.6 / 10",
        },
      ],
      skills: [
        "TypeScript & JavaScript",
        "React / Next.js",
        "Node.js & Express",
        "PostgreSQL & Redis",
        "Tailwind CSS",
        "Docker & CI/CD",
        "REST & GraphQL APIs",
        "Automated Testing",
      ],
      projects: [
        {
          id: "proj-it1",
          title: "Real-Time Document Pipeline",
          subtitle: "Node.js · WebSockets · S3",
          details:
            "Built an asynchronous document processing queue handling 10,000+ PDF conversions daily with live progress status.",
        },
      ],
      certifications: [
        {
          id: "cert-it1",
          title: "AWS Certified Developer – Associate",
          issuer: "Amazon Web Services",
          year: "2023",
        },
      ],
      languages: "English, Hindi, Marathi",
      declarationText: "",
      declarationPlace: "Hyderabad",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: true, declaration: false }),
      sectionTitles: {
        ...DEFAULT_SECTION_TITLES,
        projects: "Engineering Projects",
      },
    }),
  },
  {
    id: "finance",
    label: "Accountant & Finance",
    shortLabel: "Finance",
    recommendedTemplate: "compact",
    recommendedAccent: "#1E293B",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "finance",
      template: "compact",
      accentColor: "#1E293B",
      fontFamily: "sans",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: false,
      photoUrl: null,
      photoShape: "square",
      fullName: "Rajesh Verma",
      jobTitle: "Senior Accountant & GST Compliance Specialist",
      email: "rajesh.verma.fin@example.com",
      phone: "",
      location: "Jaipur, Rajasthan",
      website: "",
      summary:
        "Detail-oriented Senior Accountant with 5+ years managing general ledger accounting, monthly GST/TDS filings, bank reconciliations, payroll, and statutory audit schedules using Tally Prime, Zoho Books, and Advanced Excel.",
      experience: [
        {
          id: "exp-f1",
          role: "Senior Accounts Executive",
          organization: "Apex Manufacturing & Exports",
          location: "Jaipur",
          period: "2021 – Present",
          bullets:
            "• Prepared monthly P&L statements, balance sheets, and cash-flow reports for management review.\n• Filed timely GSTR-1, GSTR-3B, and quarterly TDS returns with zero late penalties.\n• Reconciled 400+ vendor ledgers and coordinated smoothly with statutory auditors.",
        },
        {
          id: "exp-f2",
          role: "Accounts Assistant",
          organization: "S.K. Agarwal & Associates (CA Firm)",
          location: "Jaipur",
          period: "2019 – 2021",
          bullets:
            "• Handled client bookkeeping, voucher entry, and GST invoice verification for 18 SME clients.\n• Automated MIS aging reports using Excel Pivot Tables and VLOOKUP/XLOOKUP.",
        },
      ],
      education: [
        {
          id: "edu-f1",
          degree: "Master of Commerce (M.Com) — Accounting & Finance",
          institution: "University of Rajasthan",
          year: "2017 – 2019",
          grade: "76% · First Division",
        },
        {
          id: "edu-f2",
          degree: "Bachelor of Commerce (B.Com)",
          institution: "Commerce College, Jaipur",
          year: "2014 – 2017",
          grade: "First Division",
        },
      ],
      skills: [
        "Tally Prime & ERP 9",
        "GST & TDS Returns",
        "Financial Statements",
        "Bank Reconciliation",
        "Advanced MS Excel",
        "Accounts Payable / Receivable",
        "Payroll & PF/ESIC",
        "Statutory Audit Support",
      ],
      projects: [],
      certifications: [
        {
          id: "cert-f1",
          title: "Certified Industrial Accountant (CIA+)",
          issuer: "ICA Edu Skills",
          year: "2019",
        },
      ],
      languages: "English, Hindi",
      declarationText:
        "I hereby declare that the information provided above is true and correct to the best of my belief.",
      declarationPlace: "Jaipur",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: false, declaration: true }),
      sectionTitles: { ...DEFAULT_SECTION_TITLES },
    }),
  },
  {
    id: "healthcare",
    label: "Medical & Healthcare",
    shortLabel: "Healthcare",
    recommendedTemplate: "executive",
    recommendedAccent: "#065F46",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "healthcare",
      template: "executive",
      accentColor: "#065F46",
      fontFamily: "classic",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: true,
      photoUrl: null,
      photoShape: "rounded",
      fullName: "Dr. Rohan Deshmukh",
      jobTitle: "Resident Medical Officer (MBBS)",
      email: "rohan.deshmukh.med@example.com",
      phone: "",
      location: "Mumbai, Maharashtra",
      website: "",
      summary:
        "Compassionate Medical Officer with 4 years of clinical experience in inpatient ward care, emergency triage, OPD consultation, and ICU coordination. Committed to evidence-based patient care and clear communication with families.",
      experience: [
        {
          id: "exp-h1",
          role: "Resident Medical Officer (General Medicine & Emergency)",
          organization: "Sahyadri Multi-Specialty Hospital",
          location: "Mumbai",
          period: "2022 – Present",
          bullets:
            "• Managed daily ward rounds for 30+ inpatient beds and coordinated emergency triage stabilization.\n• Assisted senior consultants with diagnostic evaluations, discharge summaries, and ACLS protocols.\n• Led quarterly infection-control and clinical documentation audits.",
        },
      ],
      education: [
        {
          id: "edu-h1",
          degree: "MBBS (Bachelor of Medicine & Bachelor of Surgery)",
          institution: "Seth G.S. Medical College & KEM Hospital",
          year: "2016 – 2021",
          grade: "First Class",
        },
      ],
      skills: [
        "Emergency Triage & BLS/ACLS",
        "OPD & Inpatient Ward Care",
        "Clinical Diagnostics",
        "Electronic Medical Records",
        "Patient & Family Counseling",
        "Infection Control Protocols",
      ],
      projects: [],
      certifications: [
        {
          id: "cert-h1",
          title: "State Medical Council Registration",
          issuer: "Maharashtra Medical Council",
          year: "2022",
        },
        {
          id: "cert-h2",
          title: "ACLS & BLS Provider Certification",
          issuer: "American Heart Association",
          year: "2024",
        },
      ],
      languages: "English, Hindi, Marathi",
      declarationText:
        "I hereby confirm that all clinical qualifications and registrations listed above are true.",
      declarationPlace: "Mumbai",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: false, declaration: true }),
      sectionTitles: {
        ...DEFAULT_SECTION_TITLES,
        experience: "Clinical Experience",
        certifications: "Medical Registrations & Certifications",
      },
    }),
  },
  {
    id: "sales",
    label: "Sales & Marketing",
    shortLabel: "Sales",
    recommendedTemplate: "sidebar",
    recommendedAccent: "#7F1D1D",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "sales",
      template: "sidebar",
      accentColor: "#7F1D1D",
      fontFamily: "sans",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: true,
      photoUrl: null,
      photoShape: "rounded",
      fullName: "Kavita Nair",
      jobTitle: "Regional Sales & Key Account Manager",
      email: "kavita.nair.sales@example.com",
      phone: "",
      location: "Kochi, Kerala",
      website: "",
      summary:
        "High-performing Sales & Key Account Manager with 5+ years of B2B and retail territory expansion. Consistently exceeded annual revenue quotas by 120%+ through consultative selling and long-term client retention.",
      experience: [
        {
          id: "exp-s1",
          role: "Area Sales Manager",
          organization: "Vanguard Consumer Goods",
          location: "Kochi",
          period: "2021 – Present",
          bullets:
            "• Grew South Kerala territory revenue from ₹4.2 Cr to ₹7.6 Cr within 3 years.\n• Onboarded 28 high-value institutional accounts and maintained 93% repeat order retention.",
        },
      ],
      education: [
        {
          id: "edu-s1",
          degree: "PGDM — Marketing & Sales",
          institution: "Rajagiri Business School",
          year: "2017 – 2019",
          grade: "First Class",
        },
      ],
      skills: [
        "B2B & Channel Sales",
        "Key Account Retention",
        "Territory Expansion",
        "CRM Pipeline Management",
        "Client Presentations",
        "Revenue Forecasting",
      ],
      projects: [],
      certifications: [
        {
          id: "cert-s1",
          title: "HubSpot Inbound Sales Certification",
          issuer: "HubSpot Academy",
          year: "2023",
        },
      ],
      languages: "English, Malayalam, Hindi, Tamil",
      declarationText: "",
      declarationPlace: "Kochi",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: false, declaration: false }),
      sectionTitles: { ...DEFAULT_SECTION_TITLES },
    }),
  },
  {
    id: "design",
    label: "Graphic Design & UI/UX",
    shortLabel: "Design",
    recommendedTemplate: "creative_ribbon",
    recommendedAccent: "#0284C7",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "design",
      template: "creative_ribbon",
      accentColor: "#0284C7",
      fontFamily: "sans",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: true,
      photoUrl: null,
      photoShape: "squircle",
      fullName: "Riya Chatterjee",
      jobTitle: "Senior Brand, Print & UI/UX Designer",
      email: "riya.chatterjee.design@example.com",
      phone: "",
      location: "Pune, Maharashtra",
      website: "behance.net/riyachatterjee",
      summary:
        "Multidisciplinary Brand & Print Designer with 5+ years crafting CMYK commercial packaging, digital UI systems, large-format trade banners, and cohesive visual identities using Figma, Illustrator, Photoshop, and CorelDRAW.",
      experience: [
        {
          id: "exp-ds1",
          role: "Lead Brand & Print Visual Designer",
          organization: "ChromaPrint Creative Studio",
          location: "Pune",
          period: "2022 – Present",
          bullets:
            "• Directed packaging, brochure, and digital identity launches for 35+ D2C and hospitality brands.\n• Prepared print-ready 300 PPI CMYK pre-press files with foil die-lines and bleed calibration.\n• Built reusable Figma design systems improving campaign turnaround speed by 45%.",
        },
      ],
      education: [
        {
          id: "edu-ds1",
          degree: "B.Des in Communication & Graphic Design",
          institution: "MIT Institute of Design, Pune",
          year: "2017 – 2021",
          grade: "CGPA 8.9 / 10",
        },
      ],
      skills: [
        "Adobe Illustrator & CorelDRAW",
        "Photoshop Retouching",
        "Figma UI/UX Systems",
        "Print Pre-Press (CMYK / Bleed)",
        "Brand Identity & Logos",
        "Packaging Die-Lines",
      ],
      projects: [
        {
          id: "proj-ds1",
          title: "Commercial Foil Packaging Rebrand",
          subtitle: "2024 · Gold Print Excellence",
          details:
            "Delivered custom rigid box artwork, metallic spot labels, and retail display banners across 12 SKU lines.",
        },
      ],
      certifications: [
        {
          id: "cert-ds1",
          title: "Google UX Design Professional Certificate",
          issuer: "Coursera",
          year: "2023",
        },
      ],
      languages: "English, Hindi, Bengali",
      declarationText: "",
      declarationPlace: "Pune",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: true, declaration: false }),
      sectionTitles: {
        ...DEFAULT_SECTION_TITLES,
        projects: "Featured Brand & Print Works",
      },
    }),
  },
  {
    id: "media",
    label: "Video, Photo & Creator",
    shortLabel: "Media & Photo",
    recommendedTemplate: "editorial",
    recommendedAccent: "#581C87",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "media",
      template: "editorial",
      accentColor: "#581C87",
      fontFamily: "sans",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: true,
      photoUrl: null,
      photoShape: "oval",
      fullName: "Kabir Malhotra",
      jobTitle: "Commercial Photographer, Video Editor & Content Producer",
      email: "kabir.media.pro@example.com",
      phone: "",
      location: "New Delhi",
      website: "vimeo.com/kabirmalhotra",
      summary:
        "Visual storyteller with 5 years directing studio shoots, DaVinci Resolve color grading, YouTube brand documentaries, and high-resolution event photography.",
      experience: [
        {
          id: "exp-m1",
          role: "Lead Videographer & Studio Editor",
          organization: "FrameCraft Media Production",
          location: "New Delhi",
          period: "2021 – Present",
          bullets:
            "• Shot and edited 140+ commercial reels, product films, and corporate event highlights.\n• Managed multi-camera lighting setups, audio mastering, and 300 PPI portrait retouching.",
        },
      ],
      education: [
        {
          id: "edu-m1",
          degree: "B.A. (Hons.) Mass Communication & Filmmaking",
          institution: "Guru Gobind Singh Indraprastha University",
          year: "2017 – 2020",
          grade: "First Class",
        },
      ],
      skills: [
        "Premiere Pro & DaVinci Resolve",
        "DSLR & Studio Lighting",
        "Color Grading & LUTs",
        "Portrait & Product Retouching",
        "Motion Graphics (After Effects)",
        "Directing & Storyboarding",
      ],
      projects: [],
      certifications: [],
      languages: "English, Hindi, Punjabi",
      declarationText: "",
      declarationPlace: "New Delhi",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({
        projects: false,
        certifications: false,
        declaration: false,
      }),
      sectionTitles: { ...DEFAULT_SECTION_TITLES },
    }),
  },
  {
    id: "civil",
    label: "Engineering & Architecture",
    shortLabel: "Engineering",
    recommendedTemplate: "timeline",
    recommendedAccent: "#0F766E",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "civil",
      template: "timeline",
      accentColor: "#0F766E",
      fontFamily: "classic",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: true,
      photoUrl: null,
      photoShape: "square",
      fullName: "Siddharth Rao",
      jobTitle: "Senior Civil & Structural Site Engineer",
      email: "siddharth.rao.eng@example.com",
      phone: "",
      location: "Chennai, Tamil Nadu",
      website: "",
      summary:
        "Licensed Civil & Structural Engineer with 6+ years supervising commercial high-rise construction, AutoCAD/Revit BIM drafting, BOQ estimation, and IS-code site safety audits.",
      experience: [
        {
          id: "exp-cv1",
          role: "Senior Project Site Engineer",
          organization: "Horizon Infrastructure Builders",
          location: "Chennai",
          period: "2021 – Present",
          bullets:
            "• Supervised structural execution of a 16-floor commercial tower maintaining 100% concrete quality compliance.\n• Reviewed structural AutoCAD blueprints, contractor BBS bills, and monthly milestone billing.",
        },
      ],
      education: [
        {
          id: "edu-cv1",
          degree: "B.E. in Civil Engineering",
          institution: "Anna University, Chennai",
          year: "2015 – 2019",
          grade: "CGPA 8.5 / 10",
        },
      ],
      skills: [
        "AutoCAD & Revit BIM",
        "STAAD.Pro Structural Analysis",
        "BOQ & Cost Estimation",
        "Site Supervision & QA/QC",
        "IS Code Compliance",
        "MS Project Scheduling",
      ],
      projects: [],
      certifications: [
        {
          id: "cert-cv1",
          title: "NEBOSH International General Certificate (Safety)",
          issuer: "NEBOSH",
          year: "2022",
        },
      ],
      languages: "English, Tamil, Telugu, Hindi",
      declarationText:
        "I hereby declare that all engineering qualifications and project records above are accurate.",
      declarationPlace: "Chennai",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: false, declaration: true }),
      sectionTitles: { ...DEFAULT_SECTION_TITLES },
    }),
  },
  {
    id: "hospitality",
    label: "Chef, Hotel & Hospitality",
    shortLabel: "Hospitality",
    recommendedTemplate: "monogram",
    recommendedAccent: "#92400E",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "hospitality",
      template: "monogram",
      accentColor: "#92400E",
      fontFamily: "serif",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: true,
      photoUrl: null,
      photoShape: "rounded",
      fullName: "Nikhil Kapoor",
      jobTitle: "Sous Chef & Banquet Operations Specialist",
      email: "nikhil.kapoor.chef@example.com",
      phone: "",
      location: "Goa / Mumbai",
      website: "",
      summary:
        "Culinary & Hospitality professional with 6+ years leading 5-star resort kitchens, FSSAI/HACCP hygiene standards, menu costing, and 500-guest luxury banquet service.",
      experience: [
        {
          id: "exp-ho1",
          role: "Junior Sous Chef",
          organization: "Aurelia Beachfront Resort",
          location: "Goa",
          period: "2021 – Present",
          bullets:
            "• Managed a 16-member kitchen brigade serving 400+ daily covers across Indian & Continental dining.\n• Lowered monthly food waste by 19% via strict FIFO inventory and portion standardization.",
        },
      ],
      education: [
        {
          id: "edu-ho1",
          degree: "B.Sc. in Hospitality & Hotel Administration",
          institution: "IHM Mumbai",
          year: "2016 – 2019",
          grade: "First Class",
        },
      ],
      skills: [
        "Luxury Banquet Operations",
        "HACCP & FSSAI Food Safety",
        "Menu Engineering & Costing",
        "Kitchen Brigade Supervision",
        "Inventory & Vendor Sourcing",
        "Guest Experience Standards",
      ],
      projects: [],
      certifications: [
        {
          id: "cert-ho1",
          title: "FSSAI FoSTaC Advance Catering Hygiene Certificate",
          issuer: "FSSAI India",
          year: "2024",
        },
      ],
      languages: "English, Hindi, Konkani",
      declarationText: "",
      declarationPlace: "Goa",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: false, declaration: false }),
      sectionTitles: { ...DEFAULT_SECTION_TITLES },
    }),
  },
  {
    id: "legal",
    label: "Legal & Advocate",
    shortLabel: "Legal",
    recommendedTemplate: "two_tone_frame",
    recommendedAccent: "#312E81",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "legal",
      template: "two_tone_frame",
      accentColor: "#312E81",
      fontFamily: "serif",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: false,
      photoUrl: null,
      photoShape: "square",
      fullName: "Adv. Meera Joshi",
      jobTitle: "Corporate Counsel & Civil Litigation Associate",
      email: "meera.joshi.law@example.com",
      phone: "",
      location: "New Delhi",
      website: "",
      summary:
        "Enrolled Advocate (Bar Council of Delhi) with 5 years of expertise in commercial contract drafting, regulatory compliance, arbitration pleadings, and High Court brief research.",
      experience: [
        {
          id: "exp-l1",
          role: "Legal Associate — Corporate & Commercial",
          organization: "LexBridge Partners & Advocates",
          location: "New Delhi",
          period: "2021 – Present",
          bullets:
            "• Drafted and negotiated MSAs, NDAs, vendor SLAs, and employment agreements for 25+ corporate clients.\n• Prepared written submissions, legal notices, and case digests for commercial arbitration hearings.",
        },
      ],
      education: [
        {
          id: "edu-l1",
          degree: "B.A. LL.B. (Honours)",
          institution: "National Law University",
          year: "2015 – 2020",
          grade: "First Class",
        },
      ],
      skills: [
        "Commercial Contract Drafting",
        "Legal Research & Case Briefs",
        "Corporate Compliance",
        "Arbitration & Mediation",
        "Civil Litigation Filings",
        "Due Diligence Audits",
      ],
      projects: [],
      certifications: [
        {
          id: "cert-l1",
          title: "All India Bar Examination (AIBE) Qualified Advocate",
          issuer: "Bar Council of India",
          year: "2020",
        },
      ],
      languages: "English (Fluent), Hindi (Native)",
      declarationText:
        "I verify that the credentials and Bar enrollment details stated above are true and accurate.",
      declarationPlace: "New Delhi",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: false, declaration: true }),
      sectionTitles: {
        ...DEFAULT_SECTION_TITLES,
        experience: "Legal Practice & Experience",
        certifications: "Bar Enrollment & Certifications",
      },
    }),
  },
  {
    id: "student",
    label: "Fresh Graduate / Student",
    shortLabel: "Student",
    recommendedTemplate: "compact",
    recommendedAccent: "#101F3C",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "student",
      template: "compact",
      accentColor: "#101F3C",
      fontFamily: "sans",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: true,
      photoUrl: null,
      photoShape: "rounded",
      fullName: "Ananya Sen",
      jobTitle: "Graduate Trainee / Entry-Level Analyst",
      email: "ananya.sen.grad@example.com",
      phone: "",
      location: "Kolkata, West Bengal",
      website: "",
      summary:
        "Motivated recent graduate with strong analytical skills, internship experience in operations reporting, and leadership in campus academic clubs. Eager to contribute immediately in an entry-level business or analyst role.",
      experience: [
        {
          id: "exp-st1",
          role: "Operations & Data Intern",
          organization: "Eastern Logistics Hub",
          location: "Kolkata",
          period: "May 2025 – Aug 2025",
          bullets:
            "• Compiled weekly dispatch accuracy reports across 120 daily shipments using Excel and SQL.\n• Identified packaging bottlenecks that reduced dispatch delays by 15%.",
        },
      ],
      education: [
        {
          id: "edu-st1",
          degree: "B.Sc. (Hons.) in Economics & Statistics",
          institution: "Presidency University, Kolkata",
          year: "2022 – 2025",
          grade: "CGPA 8.4 / 10",
        },
        {
          id: "edu-st2",
          degree: "Class XII (CBSE)",
          institution: "South Point High School",
          year: "2022",
          grade: "94.2%",
        },
      ],
      skills: [
        "MS Excel & Pivot Tables",
        "Data Interpretation",
        "SQL Basics",
        "Report Writing",
        "Presentation Skills",
        "Team Collaboration",
      ],
      projects: [
        {
          id: "proj-st1",
          title: "Retail Demand Forecasting Capstone",
          subtitle: "Final Year Academic Project",
          details:
            "Analyzed 3 years of seasonal retail sales data to model inventory reorder points with 89% forecast accuracy.",
        },
      ],
      certifications: [
        {
          id: "cert-st1",
          title: "Google Data Analytics Certificate",
          issuer: "Coursera",
          year: "2025",
        },
      ],
      languages: "English, Bengali, Hindi",
      declarationText:
        "I hereby declare that the details mentioned above are true to the best of my knowledge.",
      declarationPlace: "Kolkata",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: true, declaration: true }),
      sectionTitles: {
        ...DEFAULT_SECTION_TITLES,
        experience: "Internships & Experience",
        projects: "Academic Projects",
      },
    }),
  },
  {
    id: "custom",
    label: "Custom / Any Other Role",
    shortLabel: "Custom / Any",
    recommendedTemplate: "executive",
    recommendedAccent: "#1E293B",
    buildData: () => ({
      ...baseStyleDefaults(),
      professionId: "custom",
      template: "executive",
      accentColor: "#1E293B",
      fontFamily: "sans",
      paperSize: "a4",
      fontScale: 1,
      showPhoto: true,
      photoUrl: null,
      photoShape: "rounded",
      fullName: "Your Full Name",
      jobTitle: "Your Profession or Target Role",
      email: "your.email@example.com",
      phone: "",
      location: "City, State",
      website: "",
      summary:
        "Write a concise 2–3 sentence summary highlighting your core experience, key strengths, and the value you bring to employers or clients.",
      experience: [
        {
          id: "exp-c1",
          role: "Role / Designation",
          organization: "Company / School / Organization",
          location: "City",
          period: "2022 – Present",
          bullets:
            "• Describe your primary responsibility and measurable impact.\n• Highlight an achievement, project, or recognition.",
        },
      ],
      education: [
        {
          id: "edu-c1",
          degree: "Degree / Diploma / Qualification",
          institution: "University / Institute Name",
          year: "2018 – 2022",
          grade: "Grade / Percentage",
        },
      ],
      skills: ["Skill 1", "Skill 2", "Skill 3", "Skill 4"],
      projects: [],
      certifications: [],
      languages: "English, Hindi",
      declarationText:
        "I hereby declare that all information stated above is true and correct to the best of my knowledge.",
      declarationPlace: "City",
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      visibleSections: baseVisibility({ projects: false, declaration: true }),
      sectionTitles: { ...DEFAULT_SECTION_TITLES },
    }),
  },
];

export function createResumePreset(professionId: ResumeProfessionId): ResumeData {
  const found =
    PROFESSION_PRESETS.find((p) => p.id === professionId) ||
    PROFESSION_PRESETS[0];
  return found.buildData();
}
