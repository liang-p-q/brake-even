"use client";

// Decorative background for car nerds: a cross-drilled brake rotor behind a fixed caliper, a
// tachometer, and a strip of tire tread. Every motion is tied to the scroll position, not to time,
// so nothing moves unless the page is scrolling:
//   rotor spins with scroll distance · tread rolls past · tach needle and trip odometer follow how
//   far down the page you are · the rotor glows hot as you reach the results.
// People who ask their device for reduced motion get the static drawing.

import { useEffect, useRef } from "react";

const round = (n: number) => Math.round(n * 100) / 100;
/** Point at radius r and angle deg, where 0° points up and angles grow clockwise. */
const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: round(r * Math.sin(a)), y: round(-r * Math.cos(a)) };
};
/** Clockwise arc of radius r from one angle to another. */
const arc = (r: number, from: number, to: number) => {
  const [s, e] = [polar(r, from), polar(r, to)];
  return `M${s.x} ${s.y}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
};

// Rotor (viewBox -100 -100 200 200): three spiral rings of cross-drilled holes, six slots, five lugs.
const DRILL_HOLES = [66, 75, 84].flatMap((r, ring) => Array.from({ length: 12 }, (_, i) => polar(r, i * 30 + ring * 7)));
const SLOTS = Array.from({ length: 6 }, (_, i) => {
  const a = i * 60 + 17;
  const [s, c, e] = [polar(61, a), polar(77, a + 5), polar(92, a + 12)];
  return `M${s.x} ${s.y}Q${c.x} ${c.y} ${e.x} ${e.y}`;
});
const LUGS = Array.from({ length: 5 }, (_, i) => polar(25, i * 72));
const CALIPER = (() => {
  const [from, to, inner, outer] = [255, 305, 63, 104]; // left side: on screen, and clear of the headline
  const [o1, o2, i2, i1] = [polar(outer, from), polar(outer, to), polar(inner, to), polar(inner, from)];
  return `M${o1.x} ${o1.y}A${outer} ${outer} 0 0 1 ${o2.x} ${o2.y}L${i2.x} ${i2.y}A${inner} ${inner} 0 0 0 ${i1.x} ${i1.y}Z`;
})();
const CALIPER_BOLTS = [polar(83, 264), polar(83, 296)];

// Tachometer (viewBox -110 -110 220 220): 0–8 ×1000 rpm over 240°, redline from 6.5.
const TACH_MAX = 8;
const tachAngle = (v: number) => -120 + (v / TACH_MAX) * 240;
const TICKS = Array.from({ length: TACH_MAX * 2 + 1 }, (_, i) => {
  const major = i % 2 === 0;
  const [a, b] = [polar(100, tachAngle(i / 2)), polar(major ? 86 : 93, tachAngle(i / 2))];
  return { i, major, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
});
const NUMERALS = Array.from({ length: TACH_MAX + 1 }, (_, v) => ({ v, ...polar(71, tachAngle(v)) }));

// One tile of directional tire tread, used as a repeating mask so it takes the theme's color.
const TREAD_TILE =
  "<svg xmlns='http://www.w3.org/2000/svg' width='56' height='36' viewBox='0 0 56 36'>" +
  "<path d='M3 4 25 15v10L3 14zM53 4 31 15v10l22-11z' fill='black'/>" +
  "<rect x='26.5' width='3' height='36' fill='black'/></svg>";
const TREAD = `url("data:image/svg+xml,${encodeURIComponent(TREAD_TILE)}")`;

const faint = { opacity: "var(--art-opacity)" };
const accent = { opacity: "calc(var(--art-opacity) * 3.2)" };

export default function ScrollScene() {
  const scene = useRef<HTMLDivElement>(null);
  const trip = useRef<SVGTSpanElement>(null);

  useEffect(() => {
    const el = scene.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.max(window.scrollY, 0);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.style.setProperty("--y", y.toFixed(1));
      el.style.setProperty("--p", (max > 0 ? Math.min(y / max, 1) : 0).toFixed(4));
      if (trip.current) trip.current.textContent = (y / 400).toFixed(1).padStart(6, "0");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={scene}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        backgroundImage: "linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    >
      {/* Tire tread rolling past the left edge */}
      <div
        className="absolute inset-y-0 left-0 w-7 sm:w-14"
        style={{
          ...faint,
          backgroundColor: "var(--art)",
          maskImage: TREAD,
          WebkitMaskImage: TREAD,
          maskRepeat: "repeat-y",
          WebkitMaskRepeat: "repeat-y",
          maskSize: "100% auto",
          WebkitMaskSize: "100% auto",
          maskPosition: "0 calc(var(--y, 0) * -0.6px)",
          WebkitMaskPosition: "0 calc(var(--y, 0) * -0.6px)",
        }}
      />

      {/* Brake rotor spinning behind a fixed caliper */}
      <div className="absolute -top-16 -right-28 size-[300px] sm:-top-12 sm:-right-24 sm:size-[440px]" style={{ color: "var(--art)" }}>
        <svg
          viewBox="-100 -100 200 200"
          className="absolute inset-0 size-full"
          style={{ ...faint, transform: "rotate(calc(var(--y, 0) * 0.15deg))", willChange: "transform" }}
          fill="none"
          stroke="currentColor"
        >
          <circle r={96} strokeWidth={1.6} />
          <circle r={91} strokeWidth={0.6} />
          <circle r={58} strokeWidth={1.2} />
          <circle r={44} strokeWidth={1.4} />
          <circle r={13} strokeWidth={1.4} />
          {LUGS.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4.5} strokeWidth={1.2} />
          ))}
          {DRILL_HOLES.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.6} fill="currentColor" stroke="none" />
          ))}
          {SLOTS.map((d, i) => (
            <path key={i} d={d} strokeWidth={2.2} strokeLinecap="round" />
          ))}
        </svg>
        <svg viewBox="-100 -100 200 200" className="absolute inset-0 size-full">
          <defs>
            <radialGradient id="rotor-heat">
              <stop offset="0.55" style={{ stopColor: "var(--glow)", stopOpacity: 0 }} />
              <stop offset="0.74" style={{ stopColor: "var(--glow)", stopOpacity: 0.9 }} />
              <stop offset="0.9" style={{ stopColor: "#ff2d0f", stopOpacity: 0.55 }} />
              <stop offset="1" style={{ stopColor: "#ff2d0f", stopOpacity: 0 }} />
            </radialGradient>
          </defs>
          {/* Heat builds as you reach the bottom of the page */}
          <circle r={100} fill="url(#rotor-heat)" style={{ opacity: "calc(var(--p, 0) * var(--p, 0) * 0.5)" }} />
          <g
            style={{
              fill: "var(--brake)",
              stroke: "var(--brake)",
              fillOpacity: "calc(var(--art-opacity) * 1.6)",
              strokeOpacity: "calc(var(--art-opacity) * 4)",
            }}
          >
            <path d={CALIPER} strokeWidth={2} strokeLinejoin="round" />
            {CALIPER_BOLTS.map((b, i) => (
              <circle key={i} cx={b.x} cy={b.y} r={4} fill="none" strokeWidth={1.6} />
            ))}
          </g>
        </svg>
      </div>

      {/* Tachometer: the needle and trip odometer follow how far down the page you are */}
      <div className="absolute -bottom-20 -left-16 size-[290px] sm:-bottom-16 sm:-left-10 sm:size-[400px]" style={{ color: "var(--art)" }}>
        <svg viewBox="-110 -110 220 220" className="absolute inset-0 size-full">
          <g style={faint} fill="none" stroke="currentColor">
            <circle r={108} strokeWidth={1.4} />
            <path d={arc(100, tachAngle(0), tachAngle(TACH_MAX))} strokeWidth={1} />
            {TICKS.map((t) => (
              <line key={t.i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} strokeWidth={t.major ? 2.2 : 1} />
            ))}
            {NUMERALS.map((n) => (
              <text
                key={n.v}
                x={n.x}
                y={n.y}
                fontSize={14}
                textAnchor="middle"
                dominantBaseline="central"
                fill="currentColor"
                stroke="none"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {n.v}
              </text>
            ))}
            <text y={28} fontSize={7.5} letterSpacing={2} textAnchor="middle" fill="currentColor" stroke="none" style={{ fontFamily: "var(--font-mono)" }}>
              RPM ×1000
            </text>
            <rect x={-36} y={44} width={72} height={20} rx={3} strokeWidth={1} />
            <text y={58} fontSize={10.5} textAnchor="middle" fill="currentColor" stroke="none" style={{ fontFamily: "var(--font-mono)" }}>
              TRIP <tspan ref={trip}>0000.0</tspan>
            </text>
          </g>
          <path d={arc(100, tachAngle(6.5), tachAngle(TACH_MAX))} fill="none" strokeWidth={6} style={{ ...accent, stroke: "var(--brake)" }} />
        </svg>
        <svg
          viewBox="-110 -110 220 220"
          className="absolute inset-0 size-full"
          style={{ ...accent, transform: "rotate(calc(-120deg + var(--p, 0) * 240deg))", willChange: "transform" }}
        >
          <line y1={16} y2={-90} strokeWidth={3.5} strokeLinecap="round" style={{ stroke: "var(--brake)" }} />
          <circle r={8} style={{ fill: "var(--brake)" }} />
        </svg>
      </div>
    </div>
  );
}
