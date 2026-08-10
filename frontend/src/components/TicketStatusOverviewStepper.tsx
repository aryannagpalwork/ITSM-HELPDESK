import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CircleDot, Clock3, FilePlus2, LockKeyhole, Timer } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Ticket } from '../shared/types';

interface TicketStatusOverviewStepperProps { tickets: Ticket[]; }
type StatusStep = { label: string; count: number; filter: string; view?: string; detail: string; color: string; icon: React.ReactNode };

export const TicketStatusOverviewStepper: React.FC<TicketStatusOverviewStepperProps> = ({ tickets }) => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const steps = useMemo<StatusStep[]>(() => {
    const waiting = tickets.filter(ticket =>
      (ticket.status === 'open' || ticket.status === 'in_progress')
      && (ticket.awaitingCustomerResponse === true || /waiting|customer response|reply required|input needed|detail required|information needed/.test(`${ticket.title} ${ticket.description}`.toLowerCase()))
    );
    return [
      { label: 'Submitted', count: tickets.filter(ticket => ticket.status === 'open' && !waiting.includes(ticket)).length, filter: 'open', view: 'submitted', detail: 'Tickets submitted and waiting for service desk action.', color: '#38bdf8', icon: <FilePlus2 className="h-4 w-4" /> },
      { label: 'In Progress', count: tickets.filter(ticket => ticket.status === 'in_progress').length, filter: 'in_progress', detail: 'Tickets currently being investigated or worked on.', color: '#a78bfa', icon: <Timer className="h-4 w-4" /> },
      { label: 'Waiting for Me', count: waiting.length, filter: 'open', view: 'awaiting-response', detail: 'Tickets where your response or additional information may be needed.', color: '#f59e0b', icon: <Clock3 className="h-4 w-4" /> },
      { label: 'Resolved', count: tickets.filter(ticket => ticket.status === 'resolved' || ticket.status === 'closed').length, filter: 'resolved', view: 'resolved', detail: 'Tickets with a recorded resolution awaiting closure or confirmation.', color: '#22c55e', icon: <CircleDot className="h-4 w-4" /> },
      { label: 'Closed', count: tickets.filter(ticket => ticket.status === 'closed').length, filter: 'closed', detail: 'Completed tickets retained in your service history.', color: '#94a3b8', icon: <LockKeyhole className="h-4 w-4" /> },
    ];
  }, [tickets]);
  const current = steps[activeStep];
  const openTickets = () => navigate(`/tickets?status=${current.filter}${current.view ? `&view=${current.view}` : ''}`);

  return (
    <section className="flex min-h-[370px] h-full flex-col" aria-label="My Ticket Status Overview">
      <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-primary">My Ticket Status Overview</h3><p className="mt-1 text-[10px] text-tertiary">Select a status to review the matching tickets</p></div><span className="inline-flex items-center gap-1 rounded-full border border-token px-2 py-1 text-[9px] font-mono text-tertiary" style={{ color: current.color }}>{current.icon}<span>{current.label}</span></span></div>
      <div className="mb-5 flex items-center gap-1" role="tablist" aria-label="Ticket statuses">
        {steps.map((step, index) => <React.Fragment key={step.label}><button type="button" role="tab" aria-selected={activeStep === index} aria-label={`Show ${step.label} tickets`} onClick={() => setActiveStep(index)} className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: activeStep === index ? step.color : 'var(--border)', backgroundColor: activeStep === index ? `${step.color}22` : 'var(--card-bg-solid)', color: activeStep === index ? step.color : 'var(--text-tertiary)' }}>{step.icon}{activeStep === index && <motion.span layoutId="ticket-status-dot" className="absolute -bottom-1 h-1 w-1 rounded-full" style={{ backgroundColor: step.color }} />}</button>{index < steps.length - 1 && <div className="h-px min-w-2 flex-1 bg-[var(--border)]" />}</React.Fragment>)}
      </div>
      <motion.div key={activeStep} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }} className="flex flex-1 flex-col justify-between rounded-xl border border-token bg-app p-4">
        <div><div className="mb-4 flex items-center gap-2" style={{ color: current.color }}>{current.icon}<span className="text-[10px] font-mono uppercase tracking-wide">{current.label}</span></div><div className="flex items-end gap-2"><span className="text-4xl font-bold text-primary">{current.count}</span><span className="mb-1 text-xs text-secondary">{current.label}</span></div><p className="mt-3 text-[11px] leading-relaxed text-tertiary">{current.detail}</p></div>
        <div className="mt-5 flex items-center justify-between gap-2"><button type="button" disabled={activeStep === 0} onClick={() => setActiveStep(step => Math.max(0, step - 1))} className="inline-flex items-center gap-1 rounded-lg border border-token px-2.5 py-1.5 text-[10px] text-secondary disabled:opacity-40"><ChevronLeft className="h-3 w-3" /> Previous</button><button type="button" onClick={openTickets} className="rounded-lg px-3 py-1.5 text-[10px] font-medium text-white" style={{ backgroundColor: current.color }}>View {current.label} tickets</button><button type="button" disabled={activeStep === steps.length - 1} onClick={() => setActiveStep(step => Math.min(steps.length - 1, step + 1))} className="inline-flex items-center gap-1 rounded-lg border border-token px-2.5 py-1.5 text-[10px] text-secondary disabled:opacity-40">Next <ChevronRight className="h-3 w-3" /></button></div>
      </motion.div>
    </section>
  );
};
