import { useState, useEffect, useCallback } from 'react';
import { Activity, LogOut, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { todayKST } from '../lib/format';

import FitbitCard from './FitbitCard';
import MorningAlertCard from './MorningAlertCard';
import EdaInputCard from './EdaInputCard';
import EveningStaiCard from './EveningStaiCard';
import DailyReportCard from './DailyReportCard';
import TimeBlockChart from './TimeBlockChart';
import EdaModal from './EdaModal';

export default function Dashboard({ user, onLogout }) {
  const [alert, setAlert] = useState(null);
  const [daily, setDaily] = useState(null);
  const [timeblock, setTimeblock] = useState(null);
  const [fitbit, setFitbit] = useState(null);
  const [edaModalOpen, setEdaModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [a, d, t, f] = await Promise.all([
        api('/morning-alert'),
        api('/reports/daily'),
        api('/reports/timeblock'),
        api('/fitbit/status'),
      ]);
      setAlert(a); setDaily(d); setTimeblock(t); setFitbit(f);
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 backdrop-blur bg-white/80">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">오늘의 컨디션</div>
              <div className="text-xs text-slate-500">{user.display_name || user.user_id}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} disabled={refreshing}
              className="p-2 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onLogout}
              className="p-2 rounded-lg hover:bg-slate-100 transition text-slate-600"
              title="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4 pb-16">
        <FitbitCard fitbit={fitbit} onRefresh={loadAll} />

        <MorningAlertCard
          alert={alert}
          onRecompute={async () => { await api('/morning-alert?recompute=true'); await loadAll(); }}
          onStartEda={() => setEdaModalOpen(true)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EdaInputCard onSubmitted={loadAll} />
          <EveningStaiCard onSubmitted={loadAll} />
        </div>

        <DailyReportCard daily={daily} />
        <TimeBlockChart timeblock={timeblock} />
      </main>

      {edaModalOpen && (
        <EdaModal
          onClose={() => setEdaModalOpen(false)}
          onCompleted={loadAll}
        />
      )}
    </div>
  );
}
