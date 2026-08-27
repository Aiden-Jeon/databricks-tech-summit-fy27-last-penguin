import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
} from '@databricks/appkit-ui/react';
import {
  ArrowUpRight,
  Bot,
  Check,
  CircleDollarSign,
  Database,
  FileSearch,
  RotateCcw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { okOrThrow, resetDemoState, useSession } from '@/lib/api';

const SEGMENT_ID = 'SEG-0000214';
const EXPERIMENT_ID = 'EXP-0000009';

type LiveRow = Record<string, unknown> & {
  segment_id: string;
  conversion_rate?: number | string;
  conversion_rate_3w_ago?: number | string;
  mau?: number | string;
  conversion_at_risk_usd?: number | string;
  matching_experiment_lift?: number | string;
  recommended_action?: string;
  predicted_conversion_lift?: number | string;
  predicted_net_value_usd?: number | string;
  action_ranking?: unknown;
  scored_at?: string;
  decision_id?: string;
  decision_status?: DecisionStatus;
  approved_by?: string;
};

type DecisionStatus = 'idle' | 'proposed' | 'approved' | 'committed';
type AuditEvent = { at?: string; by?: string; action?: string; notes?: string; tool?: string };
type Decision = Record<string, unknown> & {
  id: string;
  status: Exclude<DecisionStatus, 'idle'>;
  approved_by?: string | null;
  audit_trail?: AuditEvent[];
  drafted_note?: string;
};

type AssistResult = {
  decision_id: string;
  drafted_memo: string;
  decision_status: 'proposed';
  approval_required: true;
  search_results: Array<Record<string, unknown>>;
  ranked_actions: Array<Record<string, unknown>>;
};

function number(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pct(value: unknown, fallback: number) {
  return `${(number(value, fallback) * 100).toFixed(1)}%`;
}

function currency(value: unknown, fallback: number) {
  return `$${(number(value, fallback) / 1000).toFixed(1)}K`;
}

function parseRanking(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  if (typeof value !== 'string') return [];
  try { return parseRanking(JSON.parse(value)); } catch { return []; }
}

function actionLabel(action: unknown) {
  const labels: Record<string, string> = {
    ship_proven_variant: '검증된 변형 출시',
    rollout_existing_flag: '기존 플래그 확대',
    ship_alt_variant: '대안 변형 출시',
  };
  if (typeof action !== 'string' && typeof action !== 'number') return '후보 액션';
  const key = String(action);
  return labels[key] ?? key;
}

function freshness(value?: string) {
  if (!value) return '방금 조회';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '방금 조회' : date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function GrowthDesk() {
  const { me, config, meError, configError, retry: retrySession } = useSession();
  const [row, setRow] = useState<LiveRow | null>(null);
  const [queriedAt, setQueriedAt] = useState<string>();
  const [assist, setAssist] = useState<AssistResult | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await okOrThrow(
        await fetch(`/api/live-view?segment_id=${SEGMENT_ID}`),
        '/api/live-view',
      );
      const payload = await response.json() as { queried_at: string; rows: LiveRow[] };
      setRow(payload.rows[0] ?? null);
      setQueriedAt(payload.queried_at);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const status: DecisionStatus = decision?.status ?? row?.decision_status ?? 'idle';
  const decisionId = decision?.id ?? assist?.decision_id ?? row?.decision_id;
  const audit = decision?.audit_trail ?? [];
  const ranking = useMemo(() => {
    const candidates = assist?.ranked_actions?.length ? assist.ranked_actions : parseRanking(row?.action_ranking);
    const fallback: Array<Record<string, unknown>> = [
      { action: 'ship_proven_variant', predicted_conversion_lift: 0.018, predicted_net_value_usd: 721300 },
      { action: 'rollout_existing_flag', predicted_conversion_lift: 0.011, predicted_net_value_usd: 433100 },
      { action: 'ship_alt_variant', predicted_conversion_lift: 0.006, predicted_net_value_usd: 205000 },
    ];
    return (candidates.length ? candidates : fallback).slice(0, 3);
  }, [assist, row]);

  async function investigate() {
    setBusy('assist'); setError(null);
    try {
      const response = await okOrThrow(await fetch('/api/assist', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ segment_id: SEGMENT_ID }),
      }), '/api/assist');
      const result = await response.json() as AssistResult;
      setAssist(result);
      setDecision({ id: result.decision_id, status: 'proposed', audit_trail: [{ action: 'proposed', by: 'Nimbus AI', notes: 'AI 초안 - 사람 승인 대기', at: new Date().toISOString() }], drafted_note: result.drafted_memo });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(null); }
  }

  async function transition(to: 'approve' | 'commit') {
    if (!decisionId) return;
    setBusy(to); setError(null);
    try {
      const response = await okOrThrow(await fetch(`/api/decisions/${decisionId}/${to}`, { method: 'POST' }), `/api/decisions/${decisionId}/${to}`);
      const payload = await response.json() as { decision?: Decision } & Partial<Decision>;
      const nextDecision = payload.decision ?? payload;
      if (!nextDecision.id || !nextDecision.status) throw new Error('Decision response is incomplete');
      setDecision(nextDecision as Decision);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(null); }
  }

  async function reset() {
    setBusy('reset'); setError(null);
    try {
      await resetDemoState();
      setAssist(null); setDecision(null); setResetOpen(false);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(null); }
  }

  const bootError = meError ?? configError;
  if (bootError) {
    return (
      <main className="nimbus-boot-error">
        <Alert variant="destructive">
          <AlertDescription>{bootError}</AlertDescription>
          <Button className="nimbus-control mt-3" variant="outline" onClick={retrySession}>
            다시 시도
          </Button>
        </Alert>
      </main>
    );
  }

  return (
    <main className="nimbus-app">
      <header className="nimbus-header">
        <div className="nimbus-header__inner">
          <div className="nimbus-brand" aria-label="Nimbus Growth Desk">
            <span className="nimbus-mark" aria-hidden>N</span>
            <span className="nimbus-brand__copy">
              <strong className="nimbus-brand__name">NIMBUS</strong>
              <span className="nimbus-brand__descriptor">Growth Desk</span>
            </span>
          </div>

          <div className="nimbus-header__actions">
            <Badge variant="secondary" className="nimbus-user-badge">
              <UserCheck className="size-3" />
              {me?.userEmail ?? me?.userName ?? '로그인 사용자'}
            </Badge>
            {config?.gatewayDashboardUrl && (
              <Button variant="outline" className="nimbus-control" asChild>
                <a href={config.gatewayDashboardUrl} target="_blank" rel="noreferrer">
                  <CircleDollarSign className="size-4" />
                  AI 비용
                  <ArrowUpRight className="size-3" />
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              className="nimbus-control nimbus-control--quiet"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw className="size-4" />
              초기화
            </Button>
          </div>
        </div>
      </header>

      <div className="nimbus-shell">
        <section className="nimbus-brief" aria-labelledby="decision-title">
          <div className="nimbus-brief__copy">
            <p className="nimbus-person">
              <span className="nimbus-person__signal" aria-hidden />
              Sofia Marchetti · VP Growth
            </p>
            <h1 id="decision-title">전환 하락을 찾고, 오늘 25% 롤아웃을 결정합니다</h1>
            <p className="nimbus-brief__lede">
              {SEGMENT_ID} · Gen-Z / Android · 회사 전체 1%p 가치와 이 세그먼트 기회는
              서로 다른 범위입니다.
            </p>
          </div>

          <aside className="nimbus-source" aria-label="의사결정 출처와 상태">
            <StatusBadge status={status} />
            <dl className="nimbus-source__list">
              <div>
                <dt>라이브 세그먼트</dt>
                <dd>{SEGMENT_ID}</dd>
              </div>
              <div>
                <dt>출처</dt>
                <dd>Lakebase 동기화 뷰 + 앱 의사결정 테이블</dd>
              </div>
              <div>
                <dt>갱신</dt>
                <dd>{freshness(queriedAt)}</dd>
              </div>
            </dl>
          </aside>
        </section>

        {error && (
          <Alert variant="destructive" className="nimbus-alert" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? <KpiSkeleton /> : !row ? (
          <Empty className="nimbus-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileSearch /></EmptyMedia>
              <EmptyTitle>세그먼트 결과가 없습니다</EmptyTitle>
              <EmptyDescription>동기화 상태를 확인한 뒤 다시 조회하세요.</EmptyDescription>
            </EmptyHeader>
            <Button className="nimbus-control" variant="outline" onClick={() => void load()}>다시 조회</Button>
          </Empty>
        ) : (
          <section className="nimbus-stats" aria-label="성장 의사결정 핵심 지표">
            <Kpi title="현재 전환율" value={pct(row.conversion_rate, 0.029)} context={`3주 전 ${pct(row.conversion_rate_3w_ago, 0.042)}`} tone="bad" />
            <Kpi title="월간 활성 사용자" value={`${Math.round(number(row.mau, 420000) / 1000)}K`} context="이 세그먼트 · MAU" />
            <Kpi title="위험 매출" value={currency(row.conversion_at_risk_usd, 524200)} context="세그먼트 범위" tone="bad" />
            <Kpi title="추천 액션 효과" value={`+${(number(row.predicted_conversion_lift, 0.018) * 100).toFixed(2)}%p`} context={actionLabel(row.recommended_action)} tone="good" />
            <Kpi title="예상 순가치" value={currency(row.predicted_net_value_usd, 721300)} context="비용 $5K 반영" tone="good" wide />
          </section>
        )}

        <section className="nimbus-workbench">
          <section className="nimbus-panel nimbus-evidence" aria-labelledby="evidence-title">
            <header className="nimbus-panel__header">
              <div>
                <h2 id="evidence-title">왜 이 액션인가</h2>
                <p>검색 근거와 모델 후보를 한곳에서 검토합니다.</p>
              </div>
              <FileSearch className="size-5" aria-hidden />
            </header>

            <div className="nimbus-winner">
              <div>
                <p className="nimbus-mono">{EXPERIMENT_ID}</p>
                <p className="nimbus-winner__value">+2.25%p</p>
              </div>
              <div className="nimbus-winner__copy">
                <Badge variant="secondary">실험 승자</Badge>
                <p>결제 흐름 변형 · Android Gen-Z 유사 코호트</p>
              </div>
            </div>

            <ol className="nimbus-ranking" aria-label="모델 후보 순위">
              {ranking.map((candidate, index) => (
                <li key={`${String(candidate.action ?? candidate.action_type)}-${String(candidate.predicted_net_value_usd ?? candidate.net_value_usd)}`}>
                  <span className="nimbus-ranking__index">0{index + 1}</span>
                  <strong>{actionLabel(candidate.action ?? candidate.action_type)}</strong>
                  <span className="nimbus-ranking__metrics">
                    <span>+{(number(candidate.predicted_conversion_lift ?? candidate.lift, [0.018, 0.011, 0.006][index]) * 100).toFixed(2)}%p</span>
                    <span>{currency(candidate.predicted_net_value_usd ?? candidate.net_value_usd, [721300, 433100, 205000][index])}</span>
                  </span>
                </li>
              ))}
            </ol>

            <p className="nimbus-provenance">
              <Database className="size-3.5" aria-hidden />
              Lakebase BM25 · app.search_experiments · 동기화 원본은 읽기 전용
            </p>
          </section>

          <section className="nimbus-panel nimbus-flow" aria-labelledby="flow-title">
            <header className="nimbus-panel__header nimbus-panel__header--flow">
              <div>
                <h2 id="flow-title">조사 → 승인 → 기록</h2>
                <p>AI는 초안을 만들고, 사람만 승인하며, Lakebase가 결정 체인을 기록합니다.</p>
              </div>
              <StatusBadge status={status} />
            </header>

            <ol className="nimbus-steps">
              <Step index="1" title="조사·AI 초안" active={status === 'idle'} done={status !== 'idle'} icon={<Bot className="size-4" />}>
                {status !== 'idle' ? (
                  <CompletedStep label="초안 생성 완료" />
                ) : (
                  <Button
                    className="nimbus-control nimbus-step__action"
                    data-state={busy === 'assist' ? 'loading' : undefined}
                    onClick={() => void investigate()}
                    disabled={Boolean(busy)}
                  >
                    {busy === 'assist' ? '근거 검색 중…' : '근거 검색 + 초안'}
                  </Button>
                )}
              </Step>
              <Step index="2" title="사람 승인" active={status === 'proposed'} done={status === 'approved' || status === 'committed'} icon={<UserCheck className="size-4" />}>
                {status === 'approved' || status === 'committed' ? (
                  <CompletedStep label="승인 완료" />
                ) : (
                  <Button
                    className="nimbus-control nimbus-step__action"
                    data-state={busy === 'approve' ? 'loading' : undefined}
                    variant="outline"
                    onClick={() => void transition('approve')}
                    disabled={Boolean(busy) || status !== 'proposed'}
                  >
                    {busy === 'approve' ? '승인 기록 중…' : '25% 롤아웃 승인'}
                  </Button>
                )}
              </Step>
              <Step index="3" title="결정 기록" active={status === 'approved'} done={status === 'committed'} icon={<Database className="size-4" />}>
                {status === 'committed' ? (
                  <CompletedStep label="결정 기록 완료" />
                ) : (
                  <Button
                    className="nimbus-control nimbus-step__action"
                    data-state={busy === 'commit' ? 'loading' : undefined}
                    variant="outline"
                    onClick={() => void transition('commit')}
                    disabled={Boolean(busy) || status !== 'approved'}
                  >
                    {busy === 'commit' ? '기록 중…' : '승인 결정 기록'}
                  </Button>
                )}
              </Step>
            </ol>

            {status === 'committed' && (
              <div className="nimbus-flow__restart">
                <Button
                  className="nimbus-control"
                  variant="outline"
                  onClick={() => setResetOpen(true)}
                  disabled={Boolean(busy)}
                >
                  <RotateCcw className="size-4" />
                  새 조사 시작
                </Button>
                <p>확인 후 이 세그먼트의 앱 작성 결정만 삭제하고 첫 단계로 돌아갑니다.</p>
              </div>
            )}

            {(assist?.drafted_memo || decision?.drafted_note) ? (
              <section className="nimbus-draft" aria-labelledby="draft-title">
                <div className="nimbus-draft__meta">
                  <Badge id="draft-title"><Bot className="size-3" />AI 생성 결과</Badge>
                  <Badge variant="outline"><ShieldCheck className="size-3" />사람 승인 필요</Badge>
                </div>
                <p className="nimbus-draft__body">{String(assist?.drafted_memo ?? decision?.drafted_note)}</p>
                <p className="nimbus-provenance">{SEGMENT_ID} 실시간 뷰 · {EXPERIMENT_ID} 검색 결과 · 세 가지 모델 후보</p>
              </section>
            ) : (
              <Empty className="nimbus-empty nimbus-empty--inline">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Bot /></EmptyMedia>
                  <EmptyTitle>아직 AI 초안이 없습니다</EmptyTitle>
                  <EmptyDescription>첫 단계를 실행하면 근거, 초안, 의사결정 ID가 나타납니다.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            <div className="nimbus-trace">
              <section>
                <h3>의사결정 ID</h3>
                <p className="nimbus-mono">{decisionId ?? '아직 생성되지 않음'}</p>
              </section>
              <section>
                <h3>감사 이력</h3>
                {audit.length ? (
                  <ol className="nimbus-audit">
                    {audit.map((event) => (
                      <li key={`${event.at}-${event.action}-${event.by}`}>
                        <Check className="size-4" aria-hidden />
                        <span><strong>{event.action}</strong> · {event.by}<small>{event.notes} · {freshness(event.at)}</small></span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>proposed → approved → committed 이벤트가 같은 ID에 누적됩니다.</p>
                )}
              </section>
            </div>
          </section>
        </section>

        <section className="nimbus-budget" aria-labelledby="budget-title">
          <ShieldCheck className="nimbus-budget__icon" aria-hidden />
          <div>
            <h2 id="budget-title">AI 비용은 보이고, 귀속되고, 멈춥니다</h2>
            <p>추정 토큰 비용 · application/requester/request ID 귀속 · 데모 알림 ${config?.demoBudget.alertUsd.toFixed(2) ?? '0.03'} · 하드 스톱 ${config?.demoBudget.hardStopUsd.toFixed(2) ?? '0.05'}</p>
          </div>
          {config?.gatewayDashboardUrl && (
            <Button className="nimbus-control" variant="outline" asChild>
              <a href={config.gatewayDashboardUrl} target="_blank" rel="noreferrer">
                Gateway 대시보드<ArrowUpRight className="size-4" />
              </a>
            </Button>
          )}
        </section>

        <footer className="nimbus-footer">
          <span>Nimbus · Ask → Decide → Ship</span>
          <span>Lakebase + Unity AI Gateway</span>
        </footer>
      </div>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="nimbus-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>데모 의사결정을 초기화할까요?</AlertDialogTitle>
            <AlertDialogDescription>{SEGMENT_ID}의 앱 작성 의사결정 행만 삭제합니다. Lakebase 동기화 원본과 다른 세그먼트는 변경하지 않습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="nimbus-control" disabled={busy === 'reset'}>취소</AlertDialogCancel>
            <AlertDialogAction
              className="nimbus-control"
              data-state={busy === 'reset' ? 'loading' : undefined}
              onClick={(event) => { event.preventDefault(); void reset(); }}
              disabled={busy === 'reset'}
            >
              {busy === 'reset' ? '초기화 중…' : '확인하고 초기화'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function Kpi({ title, value, context, tone, wide }: { title: string; value: string; context: string; tone?: 'good' | 'bad'; wide?: boolean }) {
  return (
    <div className={`nimbus-stat ${wide ? 'nimbus-stat--wide' : ''}`}>
      <p className="nimbus-stat__label">{title}</p>
      <p className={`nimbus-stat__value ${tone ? `is-${tone}` : ''}`}>
        {tone === 'good' && <TrendingUp className="size-4" aria-hidden />}
        {tone === 'bad' && <TrendingDown className="size-4" aria-hidden />}
        {value}
      </p>
      <p className="nimbus-stat__context">{context}</p>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <section className="nimbus-stats" aria-label="핵심 지표를 불러오는 중">
      {['conversion', 'mau', 'risk', 'lift', 'value'].map((metric, index) => (
        <div className={`nimbus-stat ${index === 4 ? 'nimbus-stat--wide' : ''}`} key={metric}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </section>
  );
}

function StatusBadge({ status }: { status: DecisionStatus }) {
  const labels: Record<DecisionStatus, string> = { idle: '시작 전', proposed: 'AI 초안 · 승인 대기', approved: '사람 승인 완료', committed: '승인 결정 기록 완료' };
  return <Badge variant="outline" className={`nimbus-status is-${status}`}><span aria-hidden />{labels[status]}</Badge>;
}

function CompletedStep({ label }: { label: string }) {
  return (
    <span className="nimbus-step__complete" role="status">
      <Check className="size-4" aria-hidden />
      {label}
    </span>
  );
}

function Step({ index, title, active, done, icon, children }: { index: string; title: string; active: boolean; done: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <li className={`nimbus-step ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}>
      <span className="nimbus-step__marker" aria-hidden>{done ? <Check className="size-4" /> : index}</span>
      <div className="nimbus-step__copy">
        <h3>{icon}{title}</h3>
        <p>{index === '1' ? '라이브 뷰와 실험 근거를 검색해 초안을 만듭니다.' : index === '2' ? '사람이 범위와 예상 가치를 확인하고 승인합니다.' : '승인된 결정과 감사 이력을 Lakebase에 하나의 ID로 저장합니다.'}</p>
      </div>
      {children}
    </li>
  );
}
