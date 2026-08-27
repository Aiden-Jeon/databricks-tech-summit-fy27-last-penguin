import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, AlertDescription, Badge, Button, Empty, EmptyDescription, EmptyHeader,
  EmptyTitle, Skeleton,
} from '@databricks/appkit-ui/react';
import { ArrowUpRight, Bot, Check, ChevronDown, CircleDollarSign, RefreshCw, Menu, Search, UserCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { okOrThrow, useSession } from '@/lib/api';

type Status = 'investigating' | 'investigation_failed' | 'proposed' | 'approved' | 'committed';
type CaseRow = Record<string, unknown> & {
  id?: string; decision_id?: string; segment_id: string; status?: Status; decision_status?: Status;
  conversion_rate?: number; conversion_rate_3w_ago?: number; predicted_conversion_lift?: number;
  conversion_at_risk_usd?: number; predicted_net_value_usd?: number; recommended_action?: string;
  rollout_pct?: number; approved_by?: string; created_at?: string; decision_created_at?: string;
  decided_at?: string; drafted_note?: string; scored_at?: string; audit_trail?: Audit[];
  experiment?: Record<string, unknown> | null;
};
type Audit = { at?: string; by?: string; action?: string; notes?: string };
type CasesPayload = { queried_at: string; cases: CaseRow[] };

const statusText: Record<Status, string> = {
  investigating: '진행 중', investigation_failed: '조사 실패', proposed: '승인 대기',
  approved: '기록 대기', committed: '기록 완료',
};
const actionText: Record<string, string> = {
  ship_proven_variant: '검증된 변형 출시', rollout_existing_flag: '기존 플래그 확대', ship_alt_variant: '대안 변형 출시',
};
const toNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const percent = (value: unknown) => `${(toNumber(value) * 100).toFixed(1)}%`;
const money = (value: unknown) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(toNumber(value));
const text = (value: unknown, fallback = '정보 없음') => typeof value === 'string' || typeof value === 'number' ? `${value}` : fallback;
const dateTime = (value: unknown) => value ? new Date(text(value, '')).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '정보 없음';
const hasKorean = (value: unknown) => typeof value === 'string' && /[가-힣]/.test(value);

export function GrowthDesk() {
  const { me, config, meError, configError, retry: retrySession } = useSession();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<CaseRow>();
  const [queriedAt, setQueriedAt] = useState<string>();
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [search, setSearch] = useState('');
  const [rollout, setRollout] = useState(100);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [inboxOpen, setInboxOpen] = useState(false);

  const loadCases = useCallback(async (preferredId?: string) => {
    setLoading(true);
    try {
      const response = await okOrThrow(await fetch('/api/cases'), '/api/cases');
      const payload = await response.json() as CasesPayload;
      setCases(payload.cases); setQueriedAt(payload.queried_at); setError(undefined);
      setSelectedId((current) => preferredId ?? current ?? payload.cases[0]?.decision_id ?? payload.cases[0]?.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadCases(); }, [loadCases]);
  useEffect(() => {
    if (!selectedId) { setDetail(undefined); return; }
    let cancelled = false; setDetailLoading(true);
    fetch(`/api/cases/${selectedId}`).then((res) => okOrThrow(res, '/api/cases/:id')).then((res) => res.json())
      .then((payload: { case: CaseRow }) => { if (!cancelled) { setDetail(payload.case); setRollout(toNumber(payload.case.rollout_pct) || 100); } })
      .catch((cause: Error) => { if (!cancelled) setError(cause.message); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const visible = useMemo(() => cases.filter((item) => {
    const status = item.decision_status ?? item.status;
    return (filter === 'all' || status === filter) && item.segment_id.toLowerCase().includes(search.trim().toLowerCase());
  }), [cases, filter, search]);

  async function nextInvestigation() {
    setBusy(true); setError(undefined);
    try {
      const response = await okOrThrow(await fetch('/api/investigations/next', { method: 'POST' }), '/api/investigations/next');
      const payload = await response.json() as { decision_id: string };
      await loadCases(payload.decision_id); setSelectedId(payload.decision_id); setInboxOpen(false);
      await executeInvestigation(payload.decision_id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  async function executeInvestigation(id: string) {
    try {
      const response = await okOrThrow(await fetch(`/api/investigations/${id}/run`, { method: 'POST' }), '/api/investigations/:id/run');
      await response.json();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      await loadCases(id);
      const refreshed = await okOrThrow(await fetch(`/api/cases/${id}`), '/api/cases/:id');
      setDetail((await refreshed.json() as { case: CaseRow }).case);
    }
  }

  async function retryInvestigation() {
    if (!selectedId) return;
    setBusy(true); setError(undefined);
    try { await executeInvestigation(selectedId); } finally { setBusy(false); }
  }

  async function transition(action: 'approve' | 'commit') {
    if (!selectedId) return; setBusy(true); setError(undefined);
    try {
      const response = await okOrThrow(await fetch(`/api/decisions/${selectedId}/${action}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: action === 'approve' ? JSON.stringify({ rollout_pct: rollout }) : undefined,
      }), `/api/decisions/:id/${action}`);
      await response.json(); await loadCases(selectedId);
      const refreshed = await okOrThrow(await fetch(`/api/cases/${selectedId}`), '/api/cases/:id');
      setDetail((await refreshed.json() as { case: CaseRow }).case);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  async function redraftMemo() {
    if (!selectedId) return;
    setBusy(true); setError(undefined);
    try {
      const response = await okOrThrow(
        await fetch(`/api/decisions/${selectedId}/redraft`, { method: 'POST' }),
        '/api/decisions/:id/redraft',
      );
      const payload = await response.json() as { drafted_note: string };
      setDetail((current) => current ? { ...current, drafted_note: payload.drafted_note } : current);
      await loadCases(selectedId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  const bootError = meError ?? configError;
  if (bootError) return <main className="case-boot"><Alert variant="destructive"><AlertDescription>{bootError}</AlertDescription><Button onClick={retrySession}>다시 시도</Button></Alert></main>;
  const status = detail?.status ?? detail?.decision_status;
  const current = toNumber(detail?.conversion_rate);
  const lift = toNumber(detail?.predicted_conversion_lift);
  const predicted = current + lift * (rollout / 100);
  const sourceTime = detail?.scored_at ?? queriedAt;

  return <main className="case-app">
    <header className="case-header">
      <div className="case-brand"><span>N</span><strong>Nimbus</strong><small>Growth Operations</small></div>
      <div className="case-header__meta">
        <Badge variant="secondary"><UserCheck className="size-3" />{me?.userEmail ?? me?.userName ?? '로그인 사용자'}</Badge>
        {config?.gatewayDashboardUrl && <Button variant="ghost" size="sm" asChild><a href={config.gatewayDashboardUrl} target="_blank" rel="noreferrer"><CircleDollarSign className="size-4" />AI 비용<ArrowUpRight className="size-3" /></a></Button>}
      </div>
    </header>
    <Button className="case-inbox-toggle" variant="outline" onClick={() => setInboxOpen((value) => !value)}><Menu className="size-4" />업무함 {cases.length}건</Button>
    <div className="case-layout">
      <aside className={`case-inbox ${inboxOpen ? 'is-open' : ''}`} aria-label="조사 업무함">
        <div className="case-inbox__head"><div><h1>조사 업무함</h1><p>최근 활동순 · {dateTime(queriedAt)}</p></div><Button onClick={() => void nextInvestigation()} disabled={busy}>{busy ? '조사 중…' : '새 조사'}</Button></div>
        <label className="case-search"><Search className="size-4" /><span className="sr-only">세그먼트 ID 검색</span><input placeholder="세그먼트 ID 검색" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="case-tabs" role="tablist" aria-label="상태 필터">
          {([['all', '전체'], ['investigating', '진행 중'], ['investigation_failed', '실패'], ['proposed', '승인 대기'], ['approved', '기록 대기'], ['committed', '완료']] as const).map(([value, label]) => <button role="tab" aria-selected={filter === value} key={value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <div className="case-list">
          {loading ? Array.from({ length: 4 }, (_, index) => <Skeleton className="case-list__skeleton" key={index} />) : visible.length ? visible.map((item) => {
            const id = String(item.decision_id ?? item.id); const itemStatus = (item.decision_status ?? item.status) as Status;
            return <button className="case-list__item" aria-current={selectedId === id} key={id} onClick={() => { setSelectedId(id); setInboxOpen(false); }}>
              <span><strong>{item.segment_id}</strong><Badge variant={itemStatus === 'committed' ? 'secondary' : 'outline'}>{statusText[itemStatus]}</Badge></span>
              <span>현재 {percent(item.conversion_rate)} · 위험 {money(item.conversion_at_risk_usd)}</span><time>{dateTime(item.decided_at ?? item.decision_created_at)}</time>
            </button>;
          }) : <Empty><EmptyHeader><EmptyTitle>조건에 맞는 케이스가 없습니다</EmptyTitle><EmptyDescription>필터를 바꾸거나 새 조사를 시작하세요.</EmptyDescription></EmptyHeader></Empty>}
        </div>
      </aside>
      <section className="case-workspace">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {detailLoading ? <div className="case-detail-skeleton"><Skeleton /><Skeleton /><Skeleton /></div> : !detail ? <Empty><EmptyHeader><EmptyTitle>케이스를 선택하세요</EmptyTitle><EmptyDescription>업무함에서 기존 케이스를 열거나 새 조사를 시작하세요.</EmptyDescription></EmptyHeader></Empty> : <>
          <div className="case-title"><div><p>{detail.segment_id}</p><h2>{status === 'investigating' ? '실험 근거와 AI 요약을 생성하고 있습니다' : status === 'investigation_failed' ? '조사를 완료하지 못했습니다' : status === 'proposed' ? '영향을 검토하고 롤아웃을 승인하세요' : status === 'approved' ? '승인된 결정을 감사 기록에 남기세요' : '결정과 전체 감사 이력이 기록되었습니다'}</h2></div><Badge>{status ? statusText[status] : '진행 중'}</Badge></div>
          {status === 'investigating' ? <section className="investigation-state" aria-live="polite"><Skeleton /><Skeleton /><Skeleton /><p>실험 근거와 AI 요약을 생성하고 있습니다</p></section> : status === 'investigation_failed' ? <section className="investigation-state"><Alert variant="destructive"><AlertDescription>{detail.audit_trail?.filter((event) => event.action === 'investigation_failed').at(-1)?.notes ?? '조사 중 오류가 발생했습니다.'}</AlertDescription></Alert><Button disabled={busy} onClick={() => void retryInvestigation()}>{busy ? '조사 중…' : '다시 조사'}</Button></section> : <>
          <ol className="case-steps">
            {(['proposed', 'approved', 'committed'] as Status[]).map((step, index, steps) => {
              const isComplete = status ? steps.indexOf(status) >= index : false;
              const isCurrent = status !== 'committed' && status === step;
              return <li className={[isComplete ? 'is-complete' : '', isCurrent ? 'is-current' : ''].filter(Boolean).join(' ')} data-testid={`case-step-${step}`} key={step}><span>{isComplete ? <Check className="size-4" /> : index + 1}</span><div><strong>{['조사', '승인', '기록'][index]}</strong><small>{['영향 보고서 생성', '롤아웃 비율 확정', '감사 이력 보존'][index]}</small></div></li>;
            })}
          </ol>
          <section className="evidence-grid" data-testid="evidence-section">
            <article><p>실험 근거</p><h3>{text(detail.experiment?.experiment_id ?? detail.target_experiment_id, '연결된 실험 없음')}</h3><span>{text(detail.experiment?.description ?? detail.experiment?.hypothesis, '상세 근거가 일부 누락되었습니다.')}</span><small>출처: 동기화된 실험 검색 · {dateTime(sourceTime)}</small></article>
          </section>
          <section className="impact-report" aria-labelledby="impact-title" data-testid="recovery-scenario">
            <div className="section-heading"><div><p>구조화된 영향 보고서</p><h3 id="impact-title">전환율 회복 시나리오</h3></div></div>
            <div className="impact-kpis"><article><span>예상 상승폭 · 추정</span><strong>+{((predicted - current) * 100).toFixed(2)}%p</strong></article><article><span>위험 매출 · 실제</span><strong>{money(detail.conversion_at_risk_usd)}</strong></article><article><span>예상 순가치 · 모델</span><strong>{money(detail.predicted_net_value_usd)}</strong></article></div>
            <div className="impact-table-wrap"><table><thead><tr><th>시나리오</th><th>전환율</th><th>분류</th></tr></thead><tbody><tr><td>3주 전</td><td>{percent(detail.conversion_rate_3w_ago)}</td><td>과거 실제</td></tr><tr><td>현재</td><td>{percent(current)}</td><td>현재 실제</td></tr><tr><td>롤아웃 후</td><td>{percent(predicted)}</td><td>단순 선형 추정</td></tr></tbody></table></div>
            <p className="impact-formula">예측 전환율 = 현재 전환율 + 모델 상승폭 × 롤아웃 비율. 실제 결과는 달라질 수 있습니다.</p>
          </section>
          <details className="ai-evidence" data-testid="ai-evidence" open>
            <summary><span><Bot className="size-4" />AI 근거 요약 <Badge variant="outline">AI 생성 · 검토 필요</Badge></span><ChevronDown className="size-4 ai-evidence__chevron" /></summary>
            <div className="ai-evidence__body">
              <div className="ai-evidence__highlights" aria-label="AI 근거 핵심 요약">
                <div><span>추천 액션</span><strong>{actionText[text(detail.recommended_action ?? detail.action_type, '')] ?? text(detail.recommended_action ?? detail.action_type)}</strong></div>
                <div><span>연결 실험</span><strong>{text(detail.experiment?.experiment_id ?? detail.target_experiment_id)}</strong></div>
                <div><span>예상 상승폭</span><strong>+{(toNumber(detail.predicted_conversion_lift) * 100).toFixed(2)}%p</strong></div>
                <div><span>예상 순가치</span><strong>{money(detail.predicted_net_value_usd)}</strong></div>
              </div>
              {status === 'proposed' && detail.drafted_note && !hasKorean(detail.drafted_note) && <Alert className="ai-evidence__legacy"><AlertDescription>이 메모는 이전 형식의 영어 초안입니다. 승인 전에 한국어 형식으로 다시 작성할 수 있습니다.</AlertDescription><Button size="sm" variant="outline" disabled={busy} onClick={() => void redraftMemo()}><RefreshCw className={busy ? 'size-4 ai-evidence__spin' : 'size-4'} />{busy ? '다시 작성 중…' : '한국어로 다시 작성'}</Button></Alert>}
              <div className="ai-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{text(detail.drafted_note, 'AI 요약이 없습니다.')}</ReactMarkdown></div>
              <p className="ai-evidence__source">AI가 생성한 초안입니다. 수치와 실행 조건을 검토한 뒤 승인하세요.</p>
            </div>
          </details>
          <section className={`approval-card approval-card--${status === 'proposed' ? 'pending' : 'approved'}`} data-testid="recommended-action"><div><p>추천 액션</p><h3>{actionText[text(detail.recommended_action ?? detail.action_type, '')] ?? text(detail.recommended_action ?? detail.action_type)}</h3></div><div className="rollout"><label htmlFor="rollout">롤아웃 비율</label><div><input id="rollout" type="number" min="1" max="100" value={rollout} disabled={status !== 'proposed'} onChange={(event) => setRollout(Number(event.target.value))} /><span>%</span></div><div>{[25, 50, 100].map((value) => <Button key={value} size="sm" variant="outline" disabled={status !== 'proposed'} onClick={() => setRollout(value)}>{value}%</Button>)}</div></div>
            {status === 'proposed' && <Button className="primary-action" disabled={busy || rollout < 1 || rollout > 100} onClick={() => void transition('approve')}>이 비율로 승인</Button>}
            {status === 'approved' && <Button className="primary-action" disabled={busy} onClick={() => void transition('commit')}>결정 기록</Button>}
          </section>
          {status === 'committed' && <section className="audit"><div className="section-heading"><div><p>영구 기록</p><h3>결정 및 감사 이력</h3></div><span>결정 ID {text(detail.id ?? detail.decision_id)}</span></div><dl><div><dt>승인자</dt><dd>{detail.approved_by ?? '정보 없음'}</dd></div><div><dt>기록 시각</dt><dd>{dateTime(detail.decided_at)}</dd></div></dl><ol>{(detail.audit_trail ?? []).map((event, index) => <li key={`${event.at ?? 'event'}-${event.action ?? index}`}><span>{index + 1}</span><div><strong>{event.action}</strong><p>{event.notes}</p><small>{event.by} · {dateTime(event.at)}</small></div></li>)}</ol></section>}
          </>}
        </>}
      </section>
    </div>
  </main>;
}
