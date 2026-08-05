import React from 'react';
import { useApp } from '../shared/AppContext';
import { 
  Settings as SettingsIcon, 
  User, 
  Sliders, 
  ShieldCheck, 
  RefreshCw, 
  Database, 
  Sparkles, 
  CheckCircle2, 
  KeyRound,
  FileText
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { currentUser, resetAllData } = useApp();

  const handleReset = () => {
    if (confirm('Are you absolutely sure you want to delete all newly created tickets, comments, knowledge articles, and restore initial factory mockups?')) {
      resetAllData();
      alert('Local database state restored successfully to defaults.');
      window.location.reload();
    }
  };

  return (
    <div id="settings-workspace" className="flex-1 bg-app p-8 overflow-y-auto h-full font-sans">
      
      {/* Upper header */}
      <div className="mb-8">
        <span className="text-[10px] font-mono tracking-widest uppercase text-tertiary">System Preferences</span>
        <h1 className="text-2xl font-bold text-primary tracking-tight">Console Settings</h1>
        <p className="text-xs text-secondary mt-1">Configure your workspace workstation, profile identities, and mock databases.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profile Card & Persona Swapping */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* User Profile Info */}
          <div className="bg-card border border-token p-6 rounded-2xl">
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-accent" />
              <span>Active Employee Credentials</span>
            </h3>

            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-accent-soft border border-token flex items-center justify-center text-accent text-base font-bold">
                {currentUser.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h4 className="text-sm font-bold text-primary">{currentUser.name}</h4>
                <p className="text-xs text-secondary mt-0.5">{currentUser.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-token text-xs">
              <div>
                <span className="block text-[10px] font-mono text-tertiary uppercase">Assigned ID Node</span>
                <span className="block text-primary font-semibold mt-1">{currentUser.id}</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono text-tertiary uppercase">Organizational Unit</span>
                <span className="block text-primary font-semibold mt-1">
                  {currentUser.role === 'Employee' ? 'Engineering (DEPT02)' : 'IT Operations (DEPT01)'}
                </span>
              </div>
            </div>
          </div>

          {/* Persona quick switch */}
          <div className="bg-card border border-token p-6 rounded-2xl">
            <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span>Identity Role Simulator</span>
            </h3>
            <p className="text-xs text-secondary leading-relaxed mb-6">
              Simulate different employee access hierarchies within the ITSM workstation to review features like private internal notes, admin dashboards, or end-user ticket creators.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                className={`p-4 rounded-xl border text-left ${
                  currentUser.role === 'Employee' 
                    ? 'bg-accent-soft border-token-strong' 
                    : 'bg-card-solid border-token hover-border'
                }`}
              >
                <span className="block text-xs font-bold text-primary">Employee Persona</span>
                <span className="block text-[10px] text-tertiary mt-1">Create requests, search knowledge articles, chat with AI Copilot.</span>
              </div>

              <div
                className={`p-4 rounded-xl border text-left ${
                  currentUser.role === 'Agent' 
                    ? 'bg-accent-soft border-token-strong' 
                    : 'bg-card-solid border-token hover-border'
                }`}
              >
                <span className="block text-xs font-bold text-primary">IT Support Agent</span>
                <span className="block text-[10px] text-tertiary mt-1">Review assigned incidents, reassign tickets, and post internal notes.</span>
              </div>

              <div
                className={`p-4 rounded-xl border text-left ${
                  currentUser.role === 'Administrator' 
                    ? 'bg-accent-soft border-token-strong' 
                    : 'bg-card-solid border-token hover-border'
                }`}
              >
                <span className="block text-xs font-bold text-primary">System Administrator</span>
                <span className="block text-[10px] text-tertiary mt-1">Full supervisor oversight, delete incident records, review security statistics.</span>
              </div>
            </div>
          </div>

          {/* Dangerous Zone */}
          <div className="bg-rose-950/[0.05] border border-rose-500/10 p-6 rounded-2xl">
            <h3 className="text-xs font-semibold text-rose-400 uppercase tracking-wider font-mono mb-2 flex items-center gap-2">
              <Database className="w-4 h-4" />
              <span>Danger Zone</span>
            </h3>
            <p className="text-xs text-secondary leading-relaxed mb-4">
              Restores the SQLite mock database replica to default factory settings. All newly created tickets, comments, activity logs, and knowledge articles will be deleted.
            </p>
            <button 
              onClick={handleReset}
              className="py-2.5 px-4 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md shadow-rose-500/5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restore Factory Mock Data</span>
            </button>
          </div>

        </div>

        {/* Credentials and Copilot tuning widgets */}
        <div className="space-y-6">
          
          {/* Active Credentials Summary */}
          <div className="bg-card border border-token p-5 rounded-2xl">
            <h3 className="text-xs font-semibold text-primary mb-4 flex items-center gap-2 pb-3 border-b border-token font-mono uppercase tracking-wider">
              <KeyRound className="w-3.5 h-3.5 text-accent" />
              <span>API Credentials</span>
            </h3>

            <div className="space-y-4">
              <div>
                <span className="block text-[10px] font-mono text-tertiary uppercase">Gemini AI Model</span>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-primary font-semibold font-mono">GEMINI_API_KEY</span>
                  <span className="text-[10px] text-green-400 font-mono bg-green-500/10 px-2 py-0.5 rounded font-semibold border border-green-500/20">CONFIGURED</span>
                </div>
                <p className="text-[9px] text-tertiary mt-1">Injected automatically from AI Studio runtime environment secrets.</p>
              </div>

              <div className="pt-3 border-t border-token">
                <span className="block text-[10px] font-mono text-tertiary uppercase">Vector Index Node</span>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-primary font-semibold font-mono">FAISS Local Index</span>
                  <span className="text-[10px] text-accent font-mono bg-accent-soft px-2 py-0.5 rounded font-semibold border border-token">ACTIVE</span>
                </div>
                <p className="text-[9px] text-tertiary mt-1">Simulated semantic search over locally embedded JSON documents.</p>
              </div>
            </div>
          </div>

          {/* Model Tuning Parameters */}
          <div className="bg-card border border-token p-5 rounded-2xl">
            <h3 className="text-xs font-semibold text-primary mb-4 flex items-center gap-2 pb-3 border-b border-token font-mono uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-accent" />
              <span>Copilot Tuning</span>
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] font-mono text-tertiary uppercase mb-1">
                  <span>Temperature</span>
                  <span className="text-secondary">0.2</span>
                </div>
                <div className="h-1.5 bg-input border border-token rounded-full relative">
                  <div className="absolute left-0 top-0 bottom-0 w-1/5 bg-accent rounded-full" />
                </div>
                <span className="text-[8px] text-tertiary mt-1 block">Lower values favor deterministic troubleshooting steps.</span>
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-mono text-tertiary uppercase mb-1">
                  <span>RAG Similarity Cutoff</span>
                  <span className="text-secondary">0.65</span>
                </div>
                <div className="h-1.5 bg-input border border-token rounded-full relative">
                  <div className="absolute left-0 top-0 bottom-0 w-2/3 bg-accent rounded-full" />
                </div>
                <span className="text-[8px] text-tertiary mt-1 block">SOP document matching threshold.</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
