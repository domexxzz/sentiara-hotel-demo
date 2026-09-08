// Decorative PromptPay-style QR (static pattern, demo only — not a real payload).
export function QrCode({ className = "code" }: { className?: string }) {
  const cells = 21;
  const seed = (x: number, y: number) => (x * 7 + y * 13 + x * y * 3) % 5 > 1;
  const finder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x > cells - 8 && y < 7) || (x < 7 && y > cells - 8);
  return (
    <svg className={className} viewBox={`0 0 ${cells} ${cells}`} fill="currentColor">
      {Array.from({ length: cells }).map((_, y) =>
        Array.from({ length: cells }).map((_, x) =>
          !finder(x, y) && seed(x, y) ? (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
          ) : null,
        ),
      )}
      {[
        [0, 0],
        [cells - 7, 0],
        [0, cells - 7],
      ].map(([fx, fy], i) => (
        <g key={i}>
          <rect x={fx} y={fy} width="7" height="7" />
          <rect x={fx + 1} y={fy + 1} width="5" height="5" fill="#fff" />
          <rect x={fx + 2} y={fy + 2} width="3" height="3" />
        </g>
      ))}
    </svg>
  );
}
