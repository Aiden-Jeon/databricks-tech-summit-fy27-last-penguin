# Nimbus Growth Desk 예상 반론과 답변

## “AI가 틀리면 누가 책임지나요?”

AI는 근거 검색과 `proposed` 초안까지만 수행합니다. 실험 ID, 관측 lift, 세 후보 액션과 출처가 함께 표시되며 로그인 사용자의 명시적 승인 없이는 커밋할 수 없습니다.

## “사람 승인을 우회할 수 있나요?”

아니요. 상태 머신은 `proposed → approved → committed`만 허용합니다. 승인 전 커밋과 `approved_by`가 없는 커밋은 거부되며 같은 decision ID의 감사 이력에 모든 전이가 남습니다.

## “$721.3K와 $4M은 같은 계산인가요?”

아닙니다. $4M/년은 회사 전체 매출 $400M에서 전환율 1%p의 단순 연간 환산입니다. $721.3K는 `SEG-0000214`에 대한 모델 예상 순가치로, 해당 세그먼트의 효과·기간·$5K 실행 비용을 반영한 별도 범위입니다.

## “+2.25%p와 +1.80%p 중 어느 것이 맞나요?”

둘 다 맞지만 의미가 다릅니다. +2.25%p는 `EXP-0000009`에서 관측된 과거 실험 결과이고, +1.80%p는 그 근거와 현재 세그먼트 특성을 사용한 추천 모델의 예상 효과입니다.

## “Gateway 대시보드의 비용은 실제 청구액인가요?”

상단 비용은 명시한 단가(입력 $0.15/M, 출력 $0.60/M)에 따른 추정치입니다. 실제 외부 모델 spend는 `system.ai_gateway.external_model_spend`에서 별도로 확인하며, Nimbus 행이 없으면 0이 아니라 NULL/미제공으로 표시합니다.

## “$0.03/$0.05가 Nimbus의 연간 AI 비용 상한인가요?”

아닙니다. 두 값은 라이브 데모에서 알림과 하드 스톱을 검증하기 위한 요청자 단위 임계값입니다. Nimbus의 연간 약 $500K 비용 상한과 동일한 금액이라고 주장하지 않습니다.

## “누가 비용을 만들었는지 어떻게 아나요?”

Gateway 사용량은 `request_tags['application']`, `requester`, `request_id`, Gateway와 모델을 함께 저장합니다. 앱은 모든 AI 호출에 `application=nimbus-growth-desk`, segment ID, experiment ID, assist run ID를 태깅합니다.

## “초기화가 원본 데이터를 지우지 않나요?”

초기화 API는 `{segment_id:"SEG-0000214", confirm:true}`만 허용하고 `app.feature_decisions_app`의 해당 세그먼트 행만 삭제합니다. 동기화 원본 테이블과 다른 세그먼트는 변경하지 않습니다.

## “왜 Lakebase가 필요한가요?”

Unity Catalog 원본은 분석·동기화 경계로 유지하면서, 앱은 저지연 검색과 트랜잭션 승인/커밋이 필요합니다. Lakebase는 읽기 전용 동기화 뷰와 앱 소유 OLTP 테이블을 분리해 이 두 요구를 같은 플랫폼에서 충족합니다.

## “다른 세그먼트나 지역으로 확장할 수 있나요?”

의사결정 계약은 segment ID, experiment ID, action ranking, approval, audit trail을 일반화해 두었습니다. 새 세그먼트는 동일 흐름으로 확장할 수 있지만, 데모 초기화만 안전을 위해 `SEG-0000214`로 제한했습니다.
