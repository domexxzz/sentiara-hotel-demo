// Hand-drawn style inline line icons — stroke follows currentColor.
type IconName =
  | "calendar"
  | "users"
  | "wifi"
  | "check"
  | "chevron"
  | "back"
  | "qr"
  | "chat"
  | "coffee"
  | "star"
  | "key"
  | "sparkle"
  | "shield"
  | "pin"
  | "phone"
  | "receipt"
  | "bed"
  | "send"
  | "plus"
  | "tag"
  | "line";

const paths: Record<IconName, React.ReactNode> = {
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="0" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 14.8c2.4.5 4 2.6 4 5.2" />
    </>
  ),
  wifi: (
    <>
      <path d="M2.5 9.5a15 15 0 0 1 19 0" />
      <path d="M6 13a10 10 0 0 1 12 0" />
      <path d="M9.3 16.4a5 5 0 0 1 5.4 0" />
      <circle cx="12" cy="19.5" r="0.6" fill="currentColor" />
    </>
  ),
  check: <path d="M4 12.5l5 5L20 6.5" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  back: <path d="M15 5l-7 7 7 7" />,
  qr: (
    <>
      <rect x="3.5" y="3.5" width="6" height="6" />
      <rect x="14.5" y="3.5" width="6" height="6" />
      <rect x="3.5" y="14.5" width="6" height="6" />
      <path d="M14.5 14.5h3v3M20.5 14.5v6M14.5 20.5h3" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-4 3.5V16H4z" />,
  coffee: (
    <>
      <path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M17 9h2.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M7 3.5v2M11 3.5v2" />
    </>
  ),
  star: (
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  ),
  key: (
    <>
      <circle cx="7.5" cy="8" r="3.5" />
      <path d="M10 10.5l8 8M15 15.5l2-2M17.5 18l2-2" />
    </>
  ),
  sparkle: (
    <path d="M12 3.5c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6z" />
  ),
  shield: <path d="M12 3.5l7 2.5v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9v-5z" />,
  pin: (
    <>
      <path d="M12 21c4-4.5 7-7.5 7-11a7 7 0 1 0-14 0c0 3.5 3 6.5 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  phone: (
    <path d="M6 3.5h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v3c0 1-.8 1.8-1.8 1.7C11 22.5 2.5 14 2.8 5.3 2.8 4.3 3.6 3.5 4.6 3.5z" />
  ),
  receipt: (
    <>
      <path d="M6 2.5l1.5 1.5L9 2.5l1.5 1.5L12 2.5l1.5 1.5L15 2.5l1.5 1.5L18 2.5v19l-1.5-1.5L15 21.5 13.5 20 12 21.5 10.5 20 9 21.5 7.5 20 6 21.5z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  bed: (
    <>
      <path d="M3 7v11M3 12h18v6M21 12v-1a3 3 0 0 0-3-3H9v4" />
      <circle cx="6.5" cy="10" r="1.6" />
    </>
  ),
  send: <path d="M4 12l16-7-7 16-2.5-6.5z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  tag: (
    <>
      <path d="M3 3.5h8L20.5 13a2 2 0 0 1 0 2.8L15.8 20.5a2 2 0 0 1-2.8 0L3.5 11z" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
    </>
  ),
  line: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="0" />
      <path d="M7.5 8.5v5M7.5 13.5h2.5M12 8.5v5M14.5 8.5v5l2.5-5v5" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  stroke = 1.7,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export type { IconName };
