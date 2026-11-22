const COLORS = ['bg-[#FA3728]', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-teal-500'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default function Avatar({ id, name, size = 44 }: { id: string; name: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?';
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${COLORS[hash(id) % COLORS.length]}`}
    >
      {initials}
    </span>
  );
}
