import { useState } from 'react';
import { Droplet, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

export default function EdaInputCard({ onSubmitted }) {
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!val) return;
    setBusy(true);
    try {
      const r = await api('/eda-check', { method: 'POST', body: JSON.stringify({ eda_value: parseFloat(val) }) });
      setLast(r);
      setVal('');
      await onSubmitted?.();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="bg-white rounded-2xl ring-1 ring-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
        <Droplet className="w-4 h-4 text-slate-500" /> EDA 수동 입력
      </div>
      <p className="text-xs text-slate-500 mb-3">Fitbit 동기화로 자동 입력됩니다. 수동도 가능합니다.</p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="number" step="0.01" min="0" required
          value={val} onChange={(e) => setVal(e.target.value)}
          placeholder="EDA 값 (μS)"
          className="flex-1 px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
        />
        <button type="submit" disabled={busy}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          기록
        </button>
      </form>
      {last && (
        <div className="mt-3 text-xs flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
          <span>EDA <strong>{last.eda_value.toFixed(2)}</strong> · z={last.eda_z?.toFixed(2)}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium tag-${last.classification}`}>
            {last.classification}
          </span>
        </div>
      )}
    </section>
  );
}
