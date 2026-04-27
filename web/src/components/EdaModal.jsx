import { useEffect, useState, useRef } from 'react';
import { X, Hand, Play, Download, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

const PHASES = {
  IDLE: 'idle',
  MEASURING: 'measuring',
  COMPLETE: 'complete',
  PULLING: 'pulling',
  DONE: 'done',
  EMPTY: 'empty',
};

export default function EdaModal({ onClose, onCompleted, fitbitConnected }) {
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [seconds, setSeconds] = useState(180);
  const [result, setResult] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  function start() {
    setPhase(PHASES.MEASURING);
    setSeconds(180);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setPhase(PHASES.COMPLETE);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function pull() {
    setPhase(PHASES.PULLING);
    try {
      const r = await api('/fitbit/sync', { method: 'POST' });
      setResult(r);
      if (r.eda_inserted > 0) {
        setPhase(PHASES.DONE);
        await onCompleted?.();
        setTimeout(onClose, 2000);
      } else {
        setPhase(PHASES.EMPTY);
      }
    } catch (e) {
      setResult({ error: e.message });
      setPhase(PHASES.EMPTY);
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const progress = ((180 - seconds) / 180) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Hand className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">EDA 측정</h2>
            <p className="text-xs text-slate-500">디바이스를 쥐고 3분간 측정하세요</p>
          </div>
        </div>

        {phase === PHASES.IDLE && (
          <div className="space-y-4">
            <div className="text-sm text-slate-600 space-y-2 leading-relaxed">
              <p>1. Fitbit 디바이스에서 <strong>EDA Scan 앱</strong>을 실행</p>
              <p>2. 손바닥을 디바이스 위에 올리고 가만히 유지</p>
              <p>3. 측정 끝나면 폰의 Fitbit 앱이 자동 sync</p>
              <p>4. 본 화면의 "결과 가져오기" 버튼을 누르면 자동 적재</p>
            </div>
            <button onClick={start}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition inline-flex items-center justify-center gap-1.5"
            >
              <Play className="w-4 h-4" /> 3분 측정 시작
            </button>
          </div>
        )}

        {phase === PHASES.MEASURING && (
          <div className="text-center py-4">
            <div className="text-6xl font-bold text-blue-600 tabular-nums my-4">{mm}:{ss}</div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-sm text-slate-600">디바이스를 쥐고 가만히 계세요</p>
          </div>
        )}

        {phase === PHASES.COMPLETE && (
          <div className="space-y-4">
            <div className="text-center py-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-900">측정 완료</div>
              <p className="text-xs text-slate-500 mt-1">Fitbit 앱이 동기화되면 결과를 가져올 수 있습니다.</p>
            </div>
            {fitbitConnected ? (
              <button onClick={pull}
                className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Fitbit에서 결과 가져오기
              </button>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                Fitbit이 연결되어 있지 않습니다. 위쪽 카드에서 연결 후 다시 시도하세요. (수동 입력은 메인 화면에서 가능합니다)
              </p>
            )}
          </div>
        )}

        {phase === PHASES.PULLING && (
          <div className="text-center py-6">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-600">Fitbit 클라우드에서 결과 받는 중…</p>
          </div>
        )}

        {phase === PHASES.DONE && result && (
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <div className="text-sm font-medium text-slate-900">EDA 스캔 {result.eda_inserted}건 적재 완료</div>
            <p className="text-xs text-slate-500 mt-2">대시보드에 자동 반영됩니다.</p>
          </div>
        )}

        {phase === PHASES.EMPTY && (
          <div className="space-y-3">
            <div className="text-amber-700 bg-amber-50 rounded-lg p-3 text-sm">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              {result?.error
                ? result.error
                : '아직 동기화된 EDA 스캔이 없습니다. 폰의 Fitbit 앱을 한 번 열어 보시고 다시 시도하세요.'}
            </div>
            <div className="flex gap-2">
              <button onClick={pull}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
              >다시 시도</button>
              <button onClick={onClose}
                className="px-4 py-2 rounded-lg ring-1 ring-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition"
              >닫기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
