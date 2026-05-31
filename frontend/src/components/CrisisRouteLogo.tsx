/**
 * CrisisRoute — Logo Kit
 * Crisis (red) + Route (white on dark backgrounds)
 */

export const BRAND = {
  red: "#E8593C",
  redDim: "rgba(232,89,60,0.15)",
  redGlow: "rgba(232,89,60,0.35)",
  navyDark: "#1a1f2e",
  abyss: "#0d1117",
  surface: "#161b27",
  surface2: "#1e2535",
  offWhite: "#f0f2f5",
  muted: "#6b7280",
  border: "rgba(255,255,255,0.07)",
  fontDisplay: "'Syne', sans-serif",
  fontBody: "'DM Sans', sans-serif",
} as const;

type LogoVariant = "dark" | "light" | "red";

const VARIANTS: Record<
  LogoVariant,
  { wordmarkColor: string; subtitleColor: string; iconBg: string; iconStroke: string }
> = {
  dark: {
    wordmarkColor: BRAND.offWhite,
    subtitleColor: BRAND.muted,
    iconBg: BRAND.navyDark,
    iconStroke: BRAND.red,
  },
  light: {
    wordmarkColor: "#0d1117",
    subtitleColor: "#6b7280",
    iconBg: "#e8eaf0",
    iconStroke: BRAND.red,
  },
  red: {
    wordmarkColor: "#ffffff",
    subtitleColor: "rgba(255,255,255,0.65)",
    iconBg: "rgba(0,0,0,0.25)",
    iconStroke: "rgba(255,255,255,0.5)",
  },
};

function Wordmark({
  size,
  variant,
  showTagline,
  stacked = false,
}: {
  size: number;
  variant: LogoVariant;
  showTagline?: boolean;
  stacked?: boolean;
}) {
  const v = VARIANTS[variant];
  const nameSize = stacked ? size * 0.42 : size * 0.47;

  return (
    <div className={`flex flex-col leading-none ${stacked ? "items-center" : ""}`}>
      <span
        className="font-display font-extrabold tracking-tight"
        style={{ fontSize: nameSize, lineHeight: 1 }}
      >
        <span className="text-brand-red">Crisis</span>
        <span style={{ color: v.wordmarkColor }}>Route</span>
      </span>
      {showTagline && (
        <span
          className="uppercase text-slate-500"
          style={{
            fontSize: size * 0.18,
            letterSpacing: "0.16em",
            marginTop: size * 0.06,
          }}
        >
          Disaster Response AI
        </span>
      )}
    </div>
  );
}

const LOGO_ASSET = "/logo-512.png";

export function CrisisRouteIcon({
  size = 44,
  variant = "dark",
  color,
  useImage = true,
}: {
  size?: number;
  variant?: LogoVariant;
  color?: string;
  /** Use the designed PNG mark (default) vs inline SVG */
  useImage?: boolean;
}) {
  if (useImage) {
    return (
      <img
        src={LOGO_ASSET}
        alt=""
        aria-hidden
        width={size}
        height={size}
        className="shrink-0 select-none"
        style={{ width: size, height: size }}
        draggable={false}
      />
    );
  }

  const v = VARIANTS[variant];
  const red = color || BRAND.red;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="CrisisRoute icon"
      role="img"
    >
      <circle cx="100" cy="100" r="96" fill={v.iconBg} stroke={red} strokeWidth="1.5" opacity="0.95" />
      <circle cx="100" cy="100" r="80" fill="none" stroke={red} strokeWidth="0.5" opacity="0.25" />
      <path
        d="M52 130 L72 100 L92 115 L120 72 L148 88"
        stroke={red}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.35"
      />
      <path
        d="M100 54 L138 118 H62 Z"
        fill={red}
        opacity="0.14"
        stroke={red}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M100 66 L130 114 H70 Z" fill={red} opacity="0.07" />
      <rect x="96.5" y="81" width="7" height="22" rx="3.5" fill={red} />
      <circle cx="100" cy="112" r="4" fill={red} />
      <circle cx="52" cy="130" r="4" fill={red} opacity="0.55" />
      <circle cx="92" cy="115" r="3" fill={red} opacity="0.45" />
      <circle cx="148" cy="88" r="5" fill={red} />
      <circle cx="148" cy="88" r="9" fill="none" stroke={red} strokeWidth="1.5" opacity="0.4" />
      <circle cx="148" cy="88" r="14" fill="none" stroke={red} strokeWidth="0.8" opacity="0.18" />
    </svg>
  );
}

export function CrisisRouteLogo({
  size = 44,
  variant = "dark",
  showTagline = false,
  className = "",
}: {
  size?: number;
  variant?: LogoVariant;
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center ${className}`}
      style={{ gap: size * 0.22 }}
    >
      <CrisisRouteIcon size={size} variant={variant} />
      <Wordmark size={size} variant={variant} showTagline={showTagline} />
    </div>
  );
}

export function CrisisRouteLogoStacked({
  size = 72,
  variant = "dark",
  className = "",
}: {
  size?: number;
  variant?: LogoVariant;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center ${className}`}
      style={{ gap: size * 0.14 }}
    >
      <CrisisRouteIcon size={size} variant={variant} />
      <Wordmark size={size} variant={variant} stacked />
      <span
        className="uppercase tracking-[0.18em] text-slate-500 font-medium"
        style={{ fontSize: Math.max(11, size * 0.14) }}
      >
        Disaster Response AI
      </span>
    </div>
  );
}

export function CrisisRouteFavicon({
  size = 32,
  rounded = false,
}: {
  size?: number;
  rounded?: boolean;
}) {
  const r = rounded ? Math.round(size * 0.22) : 0;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="CrisisRoute favicon"
        role="img"
      >
        <circle cx="100" cy="100" r="100" fill={BRAND.navyDark} />
        <path
          d="M100 48 L144 124 H56 Z"
          fill={BRAND.red}
          opacity="0.9"
          stroke={BRAND.red}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <rect x="94" y="74" width="12" height="28" rx="6" fill={BRAND.navyDark} />
        <circle cx="100" cy="114" r="7" fill={BRAND.navyDark} />
      </svg>
    </div>
  );
}

export default CrisisRouteLogo;
