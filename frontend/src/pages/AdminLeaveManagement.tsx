import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { LeaveManagementPanel } from '../modules/admin/components/LeaveManagementPanel';

const VALID_VIEWS = new Set(['current', 'pending', 'approved', 'rejected', 'all']);

export const AdminLeaveManagement: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view') || 'pending';
  const initialView = VALID_VIEWS.has(viewParam) ? viewParam : 'pending';

  return (
    <div className="flex-1 bg-app p-4 sm:p-6 lg:p-8 overflow-y-auto h-full font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-tertiary flex items-center gap-1.5 font-semibold">
            <CalendarDays className="w-3.5 h-3.5 text-accent" />
            <span>Leave Operations</span>
          </span>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Leave Management</h1>
          <p className="text-xs text-secondary">
            Review agent leave requests and track who is unavailable today.
          </p>
        </div>
      </div>

      <LeaveManagementPanel
        initialView={initialView as 'current' | 'pending' | 'approved' | 'rejected' | 'all'}
        onViewChange={(view) => setSearchParams({ view })}
      />
    </div>
  );
};
