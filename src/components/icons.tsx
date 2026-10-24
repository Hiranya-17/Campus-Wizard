/** Line icons in the CampusWizard style: 1.8px stroke, round joins, currentColor. */
type P = { size?: number; className?: string };

function Svg({ size = 20, className = "", children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconSparkle = (p: P) => (
  <Svg {...p}><path d="M12 3l1.6 4.6L18 9.2l-4.4 1.6L12 15.4l-1.6-4.6L6 9.2l4.4-1.6z" /><path d="M18.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /><path d="M5.5 15.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" /></Svg>
);
export const IconHome = (p: P) => <Svg {...p}><path d="M4 10.5 12 4l8 6.5V20h-5v-5.5H9V20H4z" /></Svg>;
export const IconLayers = (p: P) => <Svg {...p}><path d="M12 4 3 8.5l9 4.5 9-4.5z" /><path d="m3 12.5 9 4.5 9-4.5" /><path d="m3 16.5 9 4.5 9-4.5" /></Svg>;
export const IconCalendar = (p: P) => <Svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></Svg>;
export const IconFood = (p: P) => <Svg {...p}><path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 3c-2 0-3 3-3 6s1 4 3 4v8" /></Svg>;
export const IconWallet = (p: P) => <Svg {...p}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16 14.5h2" /></Svg>;
export const IconBell = (p: P) => <Svg {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></Svg>;
export const IconArrowRight = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const IconChevronRight = (p: P) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>;
export const IconChevronLeft = (p: P) => <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>;
export const IconPin = (p: P) => <Svg {...p}><path d="M12 21s-6-5.6-6-10.5a6 6 0 1 1 12 0C18 15.4 12 21 12 21z" /><circle cx="12" cy="10.5" r="2" /></Svg>;
export const IconClock = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const IconSearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></Svg>;
export const IconSun = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></Svg>;
export const IconInfo = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const IconX = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconSend = (p: P) => <Svg {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Svg>;
export const IconTrain = (p: P) => <Svg {...p}><rect x="5" y="3.5" width="14" height="13" rx="3" /><path d="M5 11h14M9 20l-2 1.5M15 20l2 1.5M9 14h.01M15 14h.01" /></Svg>;
export const IconBook = (p: P) => <Svg {...p}><path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z" /><path d="M5 16.5a3 3 0 0 1 3-3h10" /></Svg>;

/** The red logo tile from the design. */
export function LogoTile({ size = 36 }: { size?: number }) {
  return (
    <span className="grid place-items-center rounded-xl bg-bu text-white shadow-sm" style={{ width: size, height: size }}>
      <IconSparkle size={Math.round(size * 0.58)} />
    </span>
  );
}
