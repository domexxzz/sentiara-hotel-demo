import type { ReactNode } from "react";

// Device shell: bezel, notch, iOS-style status bar. Screens render their own
// app bar / body / footer inside `children`.
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="phone">
      <div className="screen">
        <div className="notch" />
        <div className="statusbar">
          <span>9:41</span>
          <span className="dots" aria-hidden="true">
            <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
              <rect x="0" y="7" width="3" height="4" />
              <rect x="4.5" y="5" width="3" height="6" />
              <rect x="9" y="2.5" width="3" height="8.5" />
              <rect x="13.5" y="0" width="3" height="11" opacity="0.35" />
            </svg>
            <span />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

// Step progress rail — 4 booking phases.
export function Rail({ active }: { active: number }) {
  return (
    <div className="rail" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={i <= active ? "on" : ""} />
      ))}
    </div>
  );
}
