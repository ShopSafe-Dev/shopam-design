import { Check, Clock } from 'lucide-react';
import type { OrderWorkflow } from '@/lib/api/types';

/**
 * Server-driven order stepper. Steps and their state come from `order.workflow`, the same data the API
 * uses to refuse out-of-order actions, so what the UI shows as locked is what the server would reject.
 */
export default function OrderSteps({ workflow, className = '' }: { workflow?: OrderWorkflow | null; className?: string }) {
  if (!workflow || workflow.steps.length === 0) return null;
  return (
    <div className={className}>
      <ol className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-semibold">
        {workflow.steps.map((s, i) => (
          <li key={s.key} className="flex shrink-0 items-center gap-1">
            {i > 0 && <span className={`h-px w-3 sm:w-5 ${s.state === 'upcoming' ? 'bg-slate-300' : 'bg-emerald-400'}`} />}
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-1 ${
                s.state === 'done'
                  ? 'bg-emerald-50 text-emerald-700'
                  : s.state === 'current'
                    ? 'bg-ink text-white'
                    : 'bg-slate-100 text-slate-500'
              }`}
              aria-current={s.state === 'current' ? 'step' : undefined}
            >
              {s.state === 'done' ? <Check size={11} strokeWidth={3} /> : s.state === 'current' ? <Clock size={11} /> : null}
              {s.label}
            </span>
          </li>
        ))}
      </ol>
      {workflow.blocked_reason && <p className="mt-2 text-[12px] font-medium text-amber-700">{workflow.blocked_reason}</p>}
    </div>
  );
}
