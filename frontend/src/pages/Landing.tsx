import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../shared/ThemeContext';
import { ThemeSelector } from '../shared/ThemeSelector';
import { 
  Sparkles, 
  ArrowRight, 
  MessageSquareCode, 
  ShieldCheck, 
  Database, 
  BookOpen, 
  Zap, 
  Search, 
  Clock, 
  BarChart3, 
  CheckCircle2, 
  TicketCheck
} from 'lucide-react';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { tokens } = useTheme();

  const features = [
    {
      icon: MessageSquareCode,
      title: 'AI-Powered Support Copilot',
      description: 'Semantic RAG engine retrieves relevant knowledge articles and historical ticket data for accurate, context-aware responses.'
    },
    {
      icon: TicketCheck,
      title: 'Intelligent Ticket Generation',
      description: 'Automatically creates structured tickets with proper categorization, priority assignment, and summarization from natural language conversations.'
    },
    {
      icon: Database,
      title: 'Enterprise Knowledge Base',
      description: 'Secure ingestion pipeline for documents, PDFs, and SOPs with advanced chunking and embedding management.'
    },
    {
      icon: ShieldCheck,
      title: 'Role-Based Access Control',
      description: 'Strict RBAC ensuring employees, agents, and administrators only access information relevant to their roles.'
    }
  ];

  const stats = [
    { label: 'Resolution Rate', value: '72%' },
    { label: 'Avg. Response Time', value: '2.1m' },
    { label: 'SLA Compliance', value: '94.2%' },
    { label: 'TTR Reduction', value: '48%' }
  ];

  return (
    <div id="landing-container" className="min-h-screen font-sans flex flex-col" style={{ backgroundColor: 'var(--app-bg)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header className="backdrop-blur-sm sticky top-0 z-50" style={{ backgroundColor: 'var(--navbar-bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto w-full px-6 py-5 flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="p-2 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-primary)' }}>
              <Sparkles className="w-5 h-5" style={{ color: 'var(--accent-primary-contrast)' }} />
            </div>
            <span className="font-semibold tracking-tight text-base" style={{ color: 'var(--text-primary)' }}>ITSM Copilot</span>
          </div>
          <div className="flex items-center space-x-3">
            <ThemeSelector compact />
            <button 
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-xs font-medium transition-colors cursor-pointer rounded-md"
              style={{ color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
              onMouseEnter={(e)=>{ e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.backgroundColor='var(--hover)'; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.backgroundColor='transparent'; }}
            >
              Sign In
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--text-primary)', color: 'var(--app-bg)' }}
              onMouseEnter={(e)=>{ e.currentTarget.style.opacity='0.9'; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.opacity='1'; }}
            >
              Launch Workstation
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Messaging */}
            <div className="space-y-8">
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-md" style={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border)' }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--status-success)' }} />
                <span className="text-[10px] uppercase font-mono tracking-wider font-medium" style={{ color: 'var(--text-secondary)' }}>Enterprise IT Service Management</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight" style={{ color: 'var(--text-primary)' }}>
                Streamline IT support with
                <span style={{ color: 'var(--accent-primary)' }}> intelligent automation</span>
              </h1>

              <p className="text-sm sm:text-base leading-relaxed max-w-xl" style={{ color: 'var(--text-secondary)' }}>
                Resolve incidents faster, reduce support workload, and empower employees with self-service tools backed by AI-powered knowledge retrieval and ticket automation.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-5 py-3 rounded-md font-medium text-sm flex items-center space-x-2 transition-colors cursor-pointer"
                  style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-contrast)' }}
                  onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor='var(--accent-primary-hover)'; }}
                  onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor='var(--accent-primary)'; }}
                >
                  <span>Open Demo Console</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4">
                {stats.map((stat, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="text-xl sm:text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{stat.value}</div>
                    <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Product Preview Mockup */}
            <div className="relative">
              <div className="rounded-lg overflow-hidden shadow-2xl" style={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border)' }}>
                {/* Mockup Header */}
                <div className="px-4 py-3 flex items-center space-x-2" style={{ backgroundColor: 'var(--card-bg-solid)', borderBottom: '1px solid var(--border)' }}>
                  <div className="flex space-x-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--text-tertiary)' }} />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--text-tertiary)' }} />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--text-tertiary)' }} />
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center space-x-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      <span>ITSM Copilot</span>
                    </div>
                  </div>
                </div>

                {/* Mockup Content: Split View */}
                <div className="flex h-[400px]">
                  {/* Mock Sidebar */}
                  <div className="w-48 p-4 space-y-1" style={{ backgroundColor: 'var(--surface-bg)', borderRight: '1px solid var(--border)' }}>
                    <div className="flex items-center space-x-2 px-2 py-1.5 mb-4">
                      <div className="p-1.5 rounded-md" style={{ backgroundColor: 'var(--accent-primary)' }}>
                        <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary-contrast)' }} />
                      </div>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>ITSM Copilot</span>
                    </div>
                    <div className="space-y-1">
                      {[
                        { name: 'Overview', active: false, icon: BarChart3 },
                        { name: 'AI Chat', active: true, icon: MessageSquareCode },
                        { name: 'Tickets', active: false, icon: TicketCheck },
                        { name: 'Knowledge', active: false, icon: BookOpen }
                      ].map((item, i) => (
                        <div 
                          key={i} 
                          className="flex items-center space-x-2 px-2 py-1.5 rounded-md text-xs"
                          style={{ 
                            backgroundColor: item.active ? 'var(--card-bg-solid)' : 'transparent', 
                            color: item.active ? 'var(--text-primary)' : 'var(--text-tertiary)' 
                          }}
                        >
                          <item.icon className="w-3.5 h-3.5" />
                          <span>{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mock Chat & Ticket Preview */}
                  <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--app-bg)' }}>
                    {/* Chat Header */}
                    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 rounded-md" style={{ backgroundColor: `${tokens.accentPrimary}1A` }}>
                          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                        </div>
                        <div>
                          <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>AI Support Assistant</div>
                          <div className="text-[10px] flex items-center space-x-1" style={{ color: 'var(--status-success)' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--status-success)' }} />
                            <span>Online</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 p-4 space-y-3 overflow-hidden">
                      <div className="flex justify-start">
                        <div className="max-w-xs px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                          How do I reset my Okta password if I'm locked out?
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="max-w-xs px-3 py-2 rounded-md text-xs" style={{ backgroundColor: `${tokens.accentPrimary}1A`, border: `1px solid ${tokens.accentPrimary}33`, color: 'var(--text-secondary)' }}>
                          Let me retrieve the password reset SOP from our knowledge base...
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="max-w-xs px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                          <div className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Password Reset Steps:</div>
                          <ol className="list-decimal list-inside space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                            <li>Go to okta.company.com</li>
                            <li>Click "Forgot Password"</li>
                            <li>Complete MFA verification</li>
                          </ol>
                        </div>
                      </div>
                    </div>

                    {/* Mock Ticket Preview */}
                    <div className="p-3" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--hover)' }}>
                      <div className="text-[10px] font-mono uppercase mb-2 flex items-center space-x-1" style={{ color: 'var(--text-tertiary)' }}>
                        <TicketCheck className="w-3 h-3" />
                        <span>Suggested Ticket</span>
                      </div>
                      <div className="rounded-md p-2 space-y-1.5" style={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Okta Account Lockout</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase" style={{ backgroundColor: 'var(--status-warning-bg)', border: '1px solid var(--status-warning)', color: 'var(--status-warning)' }}>Medium</span>
                        </div>
                        <p className="text-[10px] line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>User is locked out of Okta account after multiple failed login attempts.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--app-bg)' }}>
          <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="text-center mb-12">
              <h2 className="text-xl sm:text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Enterprise-Grade Features</h2>
              <p className="text-sm max-w-2xl mx-auto" style={{ color: 'var(--text-tertiary)' }}>
                Built for modern IT operations with security, scalability, and reliability at the core.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div 
                    key={idx}
                    className="p-5 rounded-md transition-colors"
                    style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
                    onMouseEnter={(e)=>{ e.currentTarget.style.backgroundColor='var(--hover)'; e.currentTarget.style.borderColor='var(--border-strong)'; }}
                    onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor='var(--card-bg)'; e.currentTarget.style.borderColor='var(--border)'; }}
                  >
                    <div className="w-9 h-9 rounded-md flex items-center justify-center mb-4" style={{ backgroundColor: `${tokens.accentPrimary}1A`, border: `1px solid ${tokens.accentPrimary}33` }}>
                      <Icon className="w-4.5 h-4.5" style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>{feat.title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{feat.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--app-bg)' }}>
        <div className="max-w-7xl mx-auto w-full px-6 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
            &copy; 2026 Enterprise ITSM Corporation. All rights reserved.
          </p>
          <div className="flex space-x-6 text-xs font-medium">
            <span 
              className="cursor-pointer transition-colors" 
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e)=>{ e.currentTarget.style.color='var(--text-secondary)'; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.color='var(--text-tertiary)'; }}
            >Security</span>
            <span 
              className="cursor-pointer transition-colors" 
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e)=>{ e.currentTarget.style.color='var(--text-secondary)'; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.color='var(--text-tertiary)'; }}
            >SLA</span>
            <span 
              className="cursor-pointer transition-colors" 
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e)=>{ e.currentTarget.style.color='var(--text-secondary)'; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.color='var(--text-tertiary)'; }}
            >Documentation</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
