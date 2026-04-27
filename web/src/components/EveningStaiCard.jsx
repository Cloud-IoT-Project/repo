import { useState } from 'react';
import { Moon, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';

const OPTIONS = [
  { v: 1, label: '매우 평온' },
  { v: 2, label: '평온' },
  { v: 3, label: '보통' },
  { v: 4, label: '긴장' },
  { v: 5, label: '매우 긴장' },
];

export default function EveningStaiCard({ onSubmitted }) {
  const [score, setScore] = useState(3);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/evening-stai', { method: 'POST', body: JSON.stringify({ score, note: note || null }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await onSubmitted?.();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="bg-white rounded-2xl ring-1 ring-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
        <Moon className="w-4 h-4 text-slate-500" /> 저녁 자기평가
      </div>
      <p className="text-xs text-slate-500 mb-3">지금 얼마나 긴장 / 스트레스를 느끼시나요?</p>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-5 gap-1.5">
          {OPTIONS.map((o) => (
            <button
              key={o.v} type="button"
              onClick={() => setScore(o.v)}
              className={`py-2 rounded-lg text-xs font-medium transition ${
                score === o.v
                  ? 'bg-blue-600 text-white shadow shadow-blue-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {o.v}
            </button>
          ))}
        </div>
        <div className="text-center text-xs text-slate-500">{OPTIONS.find((o) => o.v === score)?.label}</div>
        <input
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="메모 (선택)"
          className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
        />
        <button type="submit" disabled={busy}
          className="w-full py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {saved ? <><CheckCircle2 className="w-4 h-4" /> 저장됨</> : '저장'}
        </button>
      </form>
    </section>
  );
}
