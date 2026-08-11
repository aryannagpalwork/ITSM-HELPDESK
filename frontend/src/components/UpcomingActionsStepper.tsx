import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardCheck, MessageCircle, Siren } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Ticket } from '../shared/types';

interface UpcomingActionsStepperProps { tickets: Ticket[]; }
interface ActionItem { label: string; count: number; detail: string; color: string; icon: React.ReactNode; path: string; }

const sameDay = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return !Number.isNaN(date.getTime()) && date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
};

const hasBreachedSla = (ticket: Ticket) => {
  if (ticket.slaBreached === true || ticket.slaStatus === 'Breached') return true;
  if (typeof ticket.slaRemainingHours === 'number' && ticket.slaRemainingHours <= 0) return true;
  if (!ticket.slaDueAt) return false;
  const dueAt = new Date(ticket.slaDueAt).getTime();
  return !Number.isNaN(dueAt) && dueAt <= Date.now();
};

export const UpcomingActionsStepper: React.FC<UpcomingActionsStepperProps> = ({ tickets }) => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const actions = useMemo<ActionItem[]>(() => {
    const text = (ticket: Ticket) => `${ticket.title} ${ticket.description} ${ticket.category || ''}`.toLowerCase();
    const dueToday = tickets.filter(ticket => sameDay(ticket.slaDueAt) && hasBreachedSla(ticket));
    return [
      { label: 'SLA breaches due today', count: dueToday.length, detail: 'Assigned tickets that have breached their SLA limit today, including tickets whose due time has passed before the worker persists its update.', color: '#f59e0b', icon: <AlertTriangle className="h-4 w-4" />, path: '/agent/tickets?view=sla-due-today' },
      { label: 'Pending customer responses', count: tickets.filter(ticket => ticket.status === 'waiting_for_user_response' || ((ticket.status === 'open' || ticket.status === 'in_progress') && (ticket.awaitingCustomerResponse === true || /customer|response|reply|wait(?:ing|ed)|detail required|information needed|input needed/.test(text(ticket))))).length, detail: 'Assigned tickets waiting for a response or required detail from the employee.', color: '#38bdf8', icon: <MessageCircle className="h-4 w-4" />, path: '/agent/tickets?view=awaiting-response' },
      { label: 'Assigned tickets not resolved', count: tickets.filter(ticket => ticket.status === 'open' || ticket.status === 'in_progress' || ticket.status === 'waiting_for_user_response').length, detail: 'All tickets assigned to you that are still open, in progress, or awaiting a user response.', color: '#a78bfa', icon: <ClipboardCheck className="h-4 w-4" />, path: '/agent/tickets?view=assigned-open' },
      { label: 'Critical tickets', count: tickets.filter(ticket => ticket.priority === 'critical').length, detail: 'All critical-priority tickets currently in your assignment scope.', color: '#f43f5e', icon: <Siren className="h-4 w-4" />, path: '/agent/tickets?priority=critical' },
    ];
  }, [tickets]);

  const current = actions[activeStep];
  return (
    <section className="flex h-full min-h-[370px] flex-col" aria-label="Status Overview">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h3 className="text-sm font-semibold text-primary">Status Overview</h3><p className="mt-1 text-[10px] text-tertiary">Interactive operational status from your current tickets</p></div>
        <span className="inline-flex items-center gap-1 rounded-full border border-token px-2 py-1 text-[9px] font-mono text-tertiary" style={{ color: current.color }}>{current.icon}<span>{current.label}</span></span>
      </div>
      <div className="mb-5 flex items-center gap-1.5" role="tablist" aria-label="Upcoming action steps">
        {actions.map((action, index) => <React.Fragment key={action.label}>
          <button type="button" role="tab" aria-selected={activeStep === index} aria-label={`Open ${action.label}`} onClick={() => setActiveStep(index)} className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: activeStep === index ? action.color : 'var(--border)', backgroundColor: activeStep === index ? `${action.color}22` : 'var(--card-bg-solid)', color: activeStep === index ? action.color : 'var(--text-tertiary)' }}>
            {action.icon}
            {activeStep === index && <motion.span layoutId="upcoming-action-dot" className="absolute -bottom-1 h-1 w-1 rounded-full" style={{ backgroundColor: action.color }} />}
          </button>
          {index < actions.length - 1 && <div className="h-px min-w-2 flex-1 bg-[var(--border)]" />}
        </React.Fragment>)}
      </div>
      <motion.div key={activeStep} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }} className="flex flex-1 flex-col justify-between rounded-xl border border-token bg-app p-4">
        <div><div className="mb-4 flex items-center gap-2" style={{ color: current.color }}>{current.icon}<span className="text-[10px] font-mono uppercase tracking-wide">{current.label}</span></div><div className="flex items-end gap-2"><span className="text-4xl font-bold text-primary">{current.count}</span><span className="mb-1 text-xs text-secondary">{current.label}</span></div><p className="mt-3 text-[11px] leading-relaxed text-tertiary">{current.detail}</p></div>
        <div className="mt-5 flex items-center justify-between gap-2"><button type="button" disabled={activeStep === 0} onClick={() => setActiveStep(step => Math.max(0, step - 1))} className="inline-flex items-center gap-1 rounded-lg border border-token px-2.5 py-1.5 text-[10px] text-secondary disabled:opacity-40"><ChevronLeft className="h-3 w-3" /> Previous</button><button type="button" onClick={() => navigate(current.path)} className="rounded-lg px-3 py-1.5 text-[10px] font-medium text-white" style={{ backgroundColor: current.color }}>View tickets</button><button type="button" disabled={activeStep === actions.length - 1} onClick={() => setActiveStep(step => Math.min(actions.length - 1, step + 1))} className="inline-flex items-center gap-1 rounded-lg border border-token px-2.5 py-1.5 text-[10px] text-secondary disabled:opacity-40">Next <ChevronRight className="h-3 w-3" /></button></div>
      </motion.div>
    </section>
  );
};
