import { useEffect, useState, useRef } from 'react';
import { X, Hand, Play, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';

const PHASE = {
  IDLE: 'idle',
  MEASURING: 'measuring',
  INPUT: 'input',
  SAVING: 'saving',
  DONE: 'done',
};

const TAG_LABEL = {
  LOW_SIGNAL: { label: '낮음', cls: 'tag-LOW_SIGNAL' },
  MODERATE_SIGNAL: { label: '보통', cls: 'tag-MODERATE_SIGNAL' },
  HIGH_STRESS_SIGNAL: { label: '높음', cls: 'tag-HIGH_STRESS_SIGNAL' },
};

export default function EdaModal({ onClose, onCompleted }) {
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [seconds, setSeconds] = useState(180);
  const [edaInput, setEdaInput] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  function startTimer() {
    setPhase(PHASE.MEASURING);
    setSeconds(180);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setPhase(PHASE.INPUT);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function skipTimer() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setPhase(PHASE.INPUT);
  }

  async function save(e) {
    e?.preventDefault();
    const val = parseFloat(edaInput);
    if (Number.isNaN(val) || val < 0) {
      setError('올바른 숫자를 입력해 주세요');
      return;
    }
    setError('');
    setPhase(PHASE.SAVING);
    try {
      const r = await api('/eda-check', {
        method: 'POST',
        body: JSON.stringify({ eda_value: val }),
      });
      setResult(r);
      setPhase(PHASE.DONE);
      await onCompleted?.();
      setTimeout(onClose, 2200);
    } catch (e) {
      setError(e.message);
      setPhase(PHASE.INPUT);
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const progress = ((180 - seconds) / 180) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Hand className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">EDA 측정</h2>
            <p className="text-xs text-slate-500">디바이스로 측정 후 결과를 입력하세요</p>
          </div>
        </div>

        {phase === PHASE.IDLE && (
          <div className="space-y-4">
            <ol className="text-sm text-slate-700 space-y-2 leading-relaxed">
              <li className="flex gap-2"><span className="font-semibold text-blue-600">1.</span> Charge 5에서 <strong>EDA Scan 앱</strong> 실행</li>
              <li className="flex gap-2"><span className="font-semibold text-blue-600">2.</span> 손바닥을 디바이스 위에 올리고 3분간 유지</li>
              <li className="flex gap-2"><span className="font-semibold text-blue-600">3.</span> 측정 완료 후 폰의 Fitbit 앱에서 <strong>평균 stress level</strong> 확인</li>
              <li className="flex gap-2"><span className="font-semibold text-blue-600">4.</span> 본 화면에 그 값을 입력하면 자동 분류·기록</li>
            </ol>
            <button onClick={startTimer}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition inline-flex items-center justify-center gap-1.5"
            >
              <Play className="w-4 h-4" /> 3분 측정 시작
            </button>
            <p className="text-xs text-slate-400 text-center">
              이미 측정하신 값이 있으면{' '}
              <button onClick={() => setPhase(PHASE.INPUT)} className="text-blue-600 hover:underline">
                바로 입력
              </button>
            </p>
          </div>
        )}

        {phase === PHASE.MEASURING && (
          <div className="text-center py-2">
            <div className="text-6xl font-bold text-blue-600 tabular-nums my-4">{mm}:{ss}</div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-blue-600 transition-all duration-1000 linear" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-sm text-slate-600 mb-4">디바이스를 쥐고 가만히 계세요</p>
            <button onClick={skipTimer}
              className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
            >
              건너뛰고 결과 입력 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {phase === PHASE.INPUT && (
          <form onSubmit={save} className="space-y-3">
            <div className="text-sm text-slate-600 leading-relaxed">
              폰의 Fitbit 앱에 표시된 <strong>평균 stress level</strong>(또는 EDA μS 값)을 입력해 주세요.
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1.5 block">EDA 평균값</label>
              <input
                type="number" step="0.01" min="0" autoFocus required
                value={edaInput} onChange={(e) => setEdaInput(e.target.value)}
                placeholder="예: 1.2"
                className="w-full px-3 py-2.5 rounded-lg ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm tabular-nums"
              />
              {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
            </div>
            <div className="flex gap-2">
              <button type="submit"
                className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
              >
                저장 + 분류
              </button>
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 rounded-lg ring-1 ring-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition"
              >
                취소
              </button>
            </div>
          </form>
        )}

        {phase === PHASE.SAVING && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-600">분류·저장 중…</p>
          </div>
        )}

        {phase === PHASE.DONE && result && (
          <div className="text-center py-4 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <div>
              <div className="text-sm font-medium text-slate-900">측정 기록 완료</div>
              <div className="text-xs text-slate-500 mt-1">
                EDA <strong className="text-slate-900 tabular-nums">{result.eda_value.toFixed(2)}</strong> · z={result.eda_z?.toFixed(2)}
              </div>
            </div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${TAG_LABEL[result.classification]?.cls || ''}`}>
              {TAG_LABEL[result.classification]?.label || result.classification}
            </span>
            <p className="text-xs text-slate-400">대시보드에 자동 반영됩니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
