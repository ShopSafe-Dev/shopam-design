/** Red count pill. Renders nothing for 0. */
export default function UnreadBadge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} unread`}
      className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FA3728] px-1 text-[10px] font-bold leading-none text-white ${className}`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}
