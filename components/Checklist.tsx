// "Before you approve anything": an inspection sheet you can tick off at the counter.

import type { CheckItem } from "@/lib/checklist";

function Tick() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export default function Checklist({ items, checked, onToggle }: { items: CheckItem[]; checked: string[]; onToggle: (id: string) => void }) {
  const done = items.filter((item) => checked.includes(item.id)).length;
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-wider text-muted">
        {done} of {items.length} checked
      </p>
      <ul className="mt-1 divide-y divide-line">
        {items.map((item) => {
          const on = checked.includes(item.id);
          return (
            <li key={item.id}>
              <label className="flex cursor-pointer gap-3 rounded-md py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brake/40">
                <input type="checkbox" className="sr-only" checked={on} onChange={() => onToggle(item.id)} />
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${on ? "border-ok bg-ok text-panel" : "border-line bg-panel-2"}`}
                >
                  {on && <Tick />}
                </span>
                <span>
                  <span className={`font-semibold ${on ? "text-muted line-through decoration-ok" : ""}`}>{item.title}</span>
                  <span className="block text-sm text-muted">{item.detail}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
