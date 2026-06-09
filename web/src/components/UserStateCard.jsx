export default function UserStateCard({ userState }) {
  if (!userState) {
    return (
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">오늘의 사용자 유형</h2>
        <p className="mt-3 text-sm text-slate-500">
          아직 사용자 유형 분석 결과가 없습니다.
        </p>
      </section>
    );
  }

  const recommendations = userState.recommendations || [];

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">오늘의 사용자 유형</h2>

      <div className="mt-3 inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
        {userState.cluster_name}
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold">분석 기준</h3>
        <p className="mt-2 text-sm text-slate-600">
          {userState.analysis_basis_label || '오늘 수면/심박/활동 데이터 기반'}
        </p>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold">상태 설명</h3>
        <p className="mt-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 leading-relaxed">
          {userState.description || '오늘 상태 데이터를 기반으로 사용자 유형을 분석했습니다.'}
        </p>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold">권장 해결방안</h3>

        {recommendations.length ? (
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            {recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm text-slate-700">
                {rec}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            별도 권장사항이 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}