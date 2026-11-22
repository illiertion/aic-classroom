import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function createIcon(path: ReactNode) {
  return function Icon({ size = 20, className, ...rest }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...rest}
      >
        {path}
      </svg>
    );
  };
}

export const IconArrowLeft = createIcon(<path d="M19 12H5m0 0 6-6m-6 6 6 6" />);
export const IconArrowRight = createIcon(<path d="M5 12h14m0 0-6-6m6 6-6 6" />);
export const IconCheck = createIcon(<path d="m5 12 4.5 4.5L19 7" />);
export const IconChevronRight = createIcon(<path d="m9 6 6 6-6 6" />);
export const IconChevronDown = createIcon(<path d="m6 9 6 6 6-6" />);
export const IconCopy = createIcon(
  <>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6.5A2.5 2.5 0 0 0 4 5.5v6A2.5 2.5 0 0 0 6.5 14" />
  </>,
);
export const IconDownload = createIcon(
  <>
    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </>,
);
export const IconExternal = createIcon(
  <>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M10 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5" />
  </>,
);
export const IconEye = createIcon(
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const IconFilm = createIcon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M7 5v14m10-14v14M3 9h4m10 0h4M3 15h4m10 0h4" />
  </>,
);
export const IconHome = createIcon(
  <>
    <path d="m4 10 8-6.5L20 10v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" />
    <path d="M9.5 20.5v-6h5v6" />
  </>,
);
export const IconKeyboard = createIcon(
  <>
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.5h.01M9.5 13.5h.01M13 13.5h.01M16.5 13.5h.01M8 16.5h8" />
  </>,
);
export const IconLayout = createIcon(
  <>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </>,
);
export const IconLogOut = createIcon(
  <>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8 6 12l4 4m-4-4h11" />
  </>,
);
export const IconMonitor = createIcon(
  <>
    <rect x="2.5" y="4" width="19" height="12.5" rx="2.5" />
    <path d="M8.5 20.5h7M12 16.5v4" />
  </>,
);
export const IconPlus = createIcon(<path d="M12 5v14M5 12h14" />);
export const IconQr = createIcon(
  <>
    <rect x="3" y="3" width="6" height="6" rx="1.5" />
    <rect x="15" y="3" width="6" height="6" rx="1.5" />
    <rect x="3" y="15" width="6" height="6" rx="1.5" />
    <path d="M15 15h2.5v2.5H15zM20.5 15v.01M15 20.5h.01M20.5 20.5h.01" />
  </>,
);
export const IconRadio = createIcon(
  <>
    <circle cx="12" cy="12" r="2.5" />
    <path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 16.5a6.4 6.4 0 0 0 0-9M4.5 4.5a10.6 10.6 0 0 0 0 15M19.5 19.5a10.6 10.6 0 0 0 0-15" />
  </>,
);
export const IconRefresh = createIcon(
  <>
    <path d="M20 11a8 8 0 1 0-2.6 6.3" />
    <path d="M20 4.5V11h-6" />
  </>,
);
export const IconShield = createIcon(
  <>
    <path d="M12 21s7-3.2 7-9V5.5L12 3 5 5.5V12c0 5.8 7 9 7 9Z" />
    <path d="m9 12 2 2 4-4" />
  </>,
);
export const IconSparkles = createIcon(
  <>
    <path d="M12 3.5 13.6 9l5.4 1.6L13.6 12 12 17.5 10.4 12 5 10.6 10.4 9z" />
    <path d="M18.5 16.5l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z" />
  </>,
);
export const IconTrash = createIcon(
  <>
    <path d="M4 7h16M9.5 4h5l.7 3H8.8z" />
    <path d="M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" />
    <path d="M10.5 11v6M13.5 11v6" />
  </>,
);
export const IconUsers = createIcon(
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.6a3.2 3.2 0 0 1 0 6.3M17.5 14.7A5.5 5.5 0 0 1 21 20" />
  </>,
);
export const IconVideo = createIcon(
  <>
    <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
    <path d="m15.5 10.5 5-3v9l-5-3z" />
  </>,
);
export const IconVideoOff = createIcon(
  <>
    <path d="M15.5 10.5V8.5A2.5 2.5 0 0 0 13 6H6.2M2.8 6.6A2.5 2.5 0 0 0 2.5 8.5v7A2.5 2.5 0 0 0 5 18h8a2.5 2.5 0 0 0 2.4-1.8" />
    <path d="m15.5 10.5 5-3v9l-2.5-1.5M3 3l18 18" />
  </>,
);
export const IconX = createIcon(<path d="M6 6l12 12M18 6 6 18" />);
export const IconClock = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </>,
);
export const IconAlert = createIcon(
  <>
    <path d="M10.3 4.3 2.6 17.6A1.9 1.9 0 0 0 4.3 20.5h15.4a1.9 1.9 0 0 0 1.7-2.9L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z" />
    <path d="M12 9v4.5M12 17h.01" />
  </>,
);
export const IconArchive = createIcon(
  <>
    <rect x="3" y="4" width="18" height="4.5" rx="1.5" />
    <path d="M5 8.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M10 12.5h4" />
  </>,
);
export const IconPlay = createIcon(<path d="M8 5.5v13l10-6.5z" />);
export const IconPause = createIcon(
  <>
    <path d="M9 5v14M15 5v14" />
  </>,
);
export const IconLock = createIcon(
  <>
    <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
  </>,
);
export const IconWifi = createIcon(
  <>
    <path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0" />
    <path d="M12 19.5h.01" />
  </>,
);
export const IconWifiOff = createIcon(
  <>
    <path d="M3 3l18 18M7 9.5a13 13 0 0 1 3.8-1.7M2.5 9a14 14 0 0 1 4.2-2.4M5.5 12.5a9.5 9.5 0 0 1 2.8-1.6M8.8 16a5 5 0 0 1 6.4 0M12 19.5h.01" />
  </>,
);
export const IconMaximize = createIcon(
  <>
    <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
  </>,
);
export const IconFileText = createIcon(
  <>
    <path d="M6 3h8l5 5v13H6z" />
    <path d="M14 3v5h5M9 12h7M9 15.5h7M9 19h4" />
  </>,
);
export const IconInfo = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.8h.01" />
  </>,
);
export const IconHelp = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.3A2.6 2.6 0 0 1 14.6 10c0 1.8-2.6 2-2.6 3.7M12 17h.01" />
  </>,
);
export const IconSettings = createIcon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </>,
);
export const IconMail = createIcon(
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </>,
);
export const IconUser = createIcon(
  <>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </>,
);
export const IconCode = createIcon(<path d="m8 8-4 4 4 4m8-8 4 4-4 4M13.5 5l-3 14" />);
export const IconHand = createIcon(
  <>
    <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M11 10.5V4.8a1.5 1.5 0 0 1 3 0V11" />
    <path d="M14 10.5V6.3a1.5 1.5 0 0 1 3 0V15" />
    <path d="M17 11.5a1.5 1.5 0 0 1 3 0v3a6.5 6.5 0 0 1-6.5 6.5H12a6 6 0 0 1-4.8-2.4L4 14.6a1.6 1.6 0 0 1 2.5-2l1.5 1.8" />
  </>
);
export const IconCast = createIcon(
  <>
    <path d="M3 7V5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
    <path d="M3 19a3 3 0 0 1 3 3M3 15a7 7 0 0 1 7 7M3 11a11 11 0 0 1 11 11" />
  </>
);
export const IconTrophy = createIcon(
  <>
    <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
    <path d="M8 5H5.5A1.5 1.5 0 0 0 4 6.5C4 9 5.8 10.5 8 10.5M16 5h2.5A1.5 1.5 0 0 1 20 6.5C20 9 18.2 10.5 16 10.5" />
    <path d="M12 13v4M8.5 20h7M9.5 20c0-1.8 1-3 2.5-3s2.5 1.2 2.5 3" />
  </>
);

export const IconHeart = createIcon(
  <path d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.65 12 20 12 20Z" />,
);
export const IconChat = createIcon(
  <path d="M21 12a8 8 0 0 1-8 8H8l-4 3v-6.5A8 8 0 1 1 21 12Z" />,
);

