// The Brake Even mark: a drilled rotor with a red caliper, after the brief's header art.

const holes = Array.from({ length: 8 }, (_, i) => {
  const a = ((i * 45 + 22.5) * Math.PI) / 180;
  return { x: Math.round(Math.sin(a) * 15 * 100) / 100, y: Math.round(-Math.cos(a) * 15 * 100) / 100 };
});

export default function RotorMark({ className }: { className?: string }) {
  return (
    <svg viewBox="-24 -24 48 48" className={className} aria-hidden="true">
      <circle r={19} fill="none" stroke="currentColor" strokeWidth={2.4} />
      <circle r={8} fill="none" stroke="currentColor" strokeWidth={2} />
      {holes.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.6} fill="currentColor" />
      ))}
      <path d="M8.5 -20.6A22.3 22.3 0 0 1 20.6 -8.5" fill="none" stroke="var(--brake)" strokeWidth={5} strokeLinecap="round" />
    </svg>
  );
}
