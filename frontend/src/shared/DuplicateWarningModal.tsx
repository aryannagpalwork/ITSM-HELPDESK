import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

export type DuplicateWarning = {
  status: 'exact' | 'possible' | 'none';
  similarity_score: number;
  ticket?: { id: string; ticket_number: string; title: string; status: string };
  message?: string;
};

interface DuplicateWarningModalProps {
  warning: DuplicateWarning;
  onDismiss: () => void;
  onCreateAnyway: () => void;
  isSubmitting: boolean;
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  warning,
  onDismiss,
  onCreateAnyway,
  isSubmitting,
}) => {
  const navigate = useNavigate();
  const isExact = warning.status === 'exact';
  const matchPercent = Math.round(warning.similarity_score * 100);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card-solid border border-token rounded-2xl p-6 shadow-2xl relative">
        <div className="flex items-center gap-3 mb-4">
          <div className={`rounded-full p-2 ${isExact ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary">
              {isExact ? 'Exact duplicate detected' : 'Possible duplicate detected'}
            </h3>
            <p className="text-[10px] text-secondary">
              {warning.message || (isExact
                ? 'An identical ticket already exists.'
                : 'This issue looks similar to an existing ticket.')}
            </p>
          </div>
        </div>

        {warning.ticket && (
          <div className="bg-input border border-token rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between gap-2 text-[10px] text-secondary mb-1">
              <span className="font-mono uppercase tracking-wider">Existing ticket</span>
              <span className={`font-semibold ${isExact ? 'text-red-400' : 'text-accent'}`}>
                {matchPercent >= 100 ? '100%' : `${matchPercent}%`} match
              </span>
            </div>
            <p className="text-sm font-semibold text-primary truncate">{warning.ticket.title}</p>
            <p className="text-[11px] text-tertiary mt-1">
              #{warning.ticket.ticket_number} &bull; {warning.ticket.status}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {warning.ticket && (
            <button
              type="button"
              onClick={() => navigate(`/tickets/${warning.ticket!.id}`)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-card-solid hover-surface text-secondary border border-token cursor-pointer"
            >
              View Existing Ticket
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-secondary hover-text bg-card-solid border border-token cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreateAnyway}
            className="px-4 py-2 rounded-lg text-xs font-semibold accent-btn cursor-pointer shadow-md"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Create Anyway'}
          </button>
        </div>
      </div>
    </div>
  );
};
