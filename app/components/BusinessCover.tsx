/**
 * Cover banner generated from the business name, so a vendor needs no cover upload.
 * Same name always gives the same look (seeded), so buyers and the vendor see one cover.
 */
const PALETTES: [string, string, string][] = [
  ['#FA3728', '#FF8A5B', '#FFD2A8'],
  ['#0F172A', '#334155', '#FA3728'],
  ['#7C2D12', '#EA580C', '#FDBA74'],
  ['#1E1B4B', '#4F46E5', '#A5B4FC'],
  ['#064E3B', '#059669', '#6EE7B7'],
  ['#4C0519', '#BE123C', '#FDA4AF'],
];

function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export default function BusinessCover({ name, className = '', showName = true }: { name: string; className?: string; showName?: boolean }) {
  const label = name.trim() || 'Your shop';
  const h = seed(label.toLowerCase());
  const [a, b, c] = PALETTES[h % PALETTES.length];
  const angle = 110 + (h % 70);
  const size = label.length > 22 ? 'text-2xl sm:text-3xl' : label.length > 12 ? 'text-3xl sm:text-5xl' : 'text-4xl sm:text-6xl';

  return (
    <div
      className={`relative flex items-end overflow-hidden ${className}`}
      style={{ background: `linear-gradient(${angle}deg, ${a} 0%, ${b} 58%, ${c} 100%)` }}
      role="img"
      aria-label={`${label} cover`}
    >
      <div
        aria-hidden
        className="absolute -right-10 -top-16 h-56 w-56 rounded-full opacity-25"
        style={{ background: `radial-gradient(circle, ${c}, transparent 70%)` }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.09]"
        style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '14px 14px' }}
      />
      {showName && (
      <p
        className={`relative z-10 max-w-full truncate px-5 pb-3.5 font-bricolage font-black leading-none tracking-tight text-white/95 drop-shadow-sm sm:px-7 sm:pb-5 ${size}`}
      >
        {label}
      </p>
      )}
    </div>
  );
}
