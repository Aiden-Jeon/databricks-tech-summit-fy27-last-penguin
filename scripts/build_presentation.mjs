import pptxgen from 'pptxgenjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const outDir = new URL('../submission/presentation/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const customerLogo = '/Users/jongseob.jeon/Downloads/고객로고.jpeg';
const teamPoster = '/Users/jongseob.jeon/Downloads/2.jpeg';

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Nimbus Growth Desk';
pptx.company = 'Databricks';
pptx.subject = 'Nimbus 최종 발표 및 라이브 데모';
pptx.title = 'Nimbus Growth Desk: 일주일의 결정을 점심 전에';
pptx.lang = 'ko-KR';
pptx.theme = {
  headFontFace: 'Noto Sans KR', bodyFontFace: 'Noto Sans KR', lang: 'ko-KR',
};
pptx.defineSlideMaster({
  title: 'NIMBUS',
  background: { color: 'F7F8FA' },
  objects: [
    { line: { x: 0.45, y: 7.16, w: 12.42, h: 0, line: { color: 'DCE1E7', width: 0.8 } } },
    { text: { text: 'NIMBUS  ×  DATABRICKS', options: { x: 0.5, y: 7.2, w: 3.2, h: 0.18, fontFace: 'Noto Sans KR', fontSize: 7.5, color: '5B6573', charSpacing: 1.4, margin: 0 } } },
    { text: { text: 'CONFIDENTIAL · LIVE DEMO', options: { x: 10.0, y: 7.2, w: 2.8, h: 0.18, fontFace: 'Noto Sans KR', fontSize: 7.5, color: '5B6573', align: 'right', margin: 0 } } },
  ],
  slideNumber: { x: 12.85, y: 7.18, w: 0.18, h: 0.18, color: '5B6573', fontFace: 'Noto Sans KR', fontSize: 7.5, margin: 0 },
});

const C = { navy: '0B2026', blue: '2272B4', cyan: '40D1F5', red: 'EE3D2C', orange: 'FF8F5B', green: '2F9E6F', yellow: 'FFDD4A', ink: '1F2530', muted: '5B6573', line: 'DCE1E7', white: 'FFFFFF', pale: 'EDF4FA', paleGreen: 'E8F5EF', paleRed: 'FCEDEA', dark: '11171C' };
const notes = [];

function addText(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, { x, y, w, h, fontFace: 'Noto Sans KR', fontSize: 18, color: C.ink, margin: 0, breakLine: false, valign: 'mid', fit: 'shrink', ...opts });
}
function addCustomerLogo(slide, dark = false) {
  if (dark) {
    slide.addShape(pptx.ShapeType.roundRect, { x: 10.82, y: 0.35, w: 1.76, h: 1.0, rectRadius: 0.06, fill: { color: C.white, transparency: 3 }, line: { color: 'DCE1E7', transparency: 55, width: 0.6 } });
  }
  slide.addImage({ path: customerLogo, x: 10.92, y: 0.41, w: 1.56, h: 0.88, sizing: { type: 'contain', w: 1.56, h: 0.88 }, altText: 'Nimbus customer logo' });
}
function title(slide, kicker, headline, sub = '') {
  addText(slide, kicker.toUpperCase(), 0.62, 0.38, 4.5, 0.3, { fontSize: 9, bold: true, color: C.red, charSpacing: 1.8 });
  addCustomerLogo(slide);
  addText(slide, headline, 0.62, 0.72, 10.2, 0.72, { fontSize: headline.length > 44 ? 24 : 28, bold: true, color: C.ink, valign: 'top' });
  if (sub) addText(slide, sub, 0.64, 1.48, 11.7, 0.42, { fontSize: 12, color: C.muted, valign: 'top' });
}
function pill(slide, text, x, y, w, fill = C.pale, color = C.blue) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 0.36, rectRadius: 0.08, fill: { color: fill }, line: { color: fill } });
  addText(slide, text, x + 0.08, y, w - 0.16, 0.36, { fontSize: 9, bold: true, color, align: 'center' });
}
function card(slide, x, y, w, h, heading, value, detail, accent = C.blue) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, width: 1 } });
  slide.addShape(pptx.ShapeType.rect, { x, y, w: 0.06, h, fill: { color: accent }, line: { color: accent } });
  addText(slide, heading, x + 0.22, y + 0.18, w - 0.36, 0.28, { fontSize: 10, bold: true, color: C.muted });
  addText(slide, value, x + 0.22, y + 0.53, w - 0.36, 0.58, { fontSize: 27, bold: true, color: accent });
  addText(slide, detail, x + 0.22, y + h - 0.55, w - 0.36, 0.36, { fontSize: 9.5, color: C.muted, valign: 'top' });
}
function arrow(slide, x1, y1, x2, y2, color = C.blue) {
  slide.addShape(pptx.ShapeType.line, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color, width: 2.2, beginArrowType: 'none', endArrowType: 'triangle' } });
}
function node(slide, x, y, w, h, heading, detail, accent = C.blue, dark = false) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: dark ? C.dark : C.white }, line: { color: dark ? C.dark : accent, width: 1.4 } });
  addText(slide, heading, x + 0.16, y + 0.12, w - 0.32, 0.3, { fontSize: 12, bold: true, color: dark ? C.white : C.ink, align: 'center' });
  addText(slide, detail, x + 0.16, y + 0.46, w - 0.32, h - 0.56, { fontSize: 9, color: dark ? 'C7D2D9' : C.muted, align: 'center', valign: 'top' });
}
function addNotes(slide, number, time, script) {
  const body = [`권장 시간: ${time}`, '', ...script];
  slide.addNotes(body);
  notes.push({ number, time, title: script[0].replace(/^“|”$/g, ''), body: script });
}

// 1
{
  const s = pptx.addSlide('NIMBUS');
  s.background = { color: C.dark };
  s.addImage({ path: teamPoster, x: 9.15, y: 0, w: 4.18, h: 7.5, sizing: { type: 'cover', w: 4.18, h: 7.5 }, altText: 'Last Penguins team poster' });
  s.addShape(pptx.ShapeType.rect, { x: 9.15, y: 0, w: 4.18, h: 7.5, fill: { color: C.dark, transparency: 55 }, line: { color: C.dark, transparency: 100 } });
  s.addShape(pptx.ShapeType.rect, { x: 8.7, y: 0, w: 0.75, h: 7.5, fill: { color: C.dark, transparency: 15 }, line: { color: C.dark, transparency: 100 } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: C.red }, line: { color: C.red } });
  s.addShape(pptx.ShapeType.roundRect, { x: 0.72, y: 0.45, w: 1.78, h: 1.02, rectRadius: 0.06, fill: { color: C.white }, line: { color: C.white } });
  s.addImage({ path: customerLogo, x: 0.82, y: 0.51, w: 1.58, h: 0.9, sizing: { type: 'contain', w: 1.58, h: 0.9 }, altText: 'Nimbus customer logo' });
  pill(s, 'SOFIA · 성장 책임자     NOOR · 재무 책임자', 2.72, 0.76, 3.2, '243039', 'D6E0E6');
  addText(s, 'Nimbus Growth Desk', 0.76, 1.72, 7.8, 0.68, { fontSize: 36, bold: true, color: C.white });
  addText(s, '일주일의 결정을\n점심 전에', 0.76, 2.4, 7.75, 1.45, { fontSize: 42, bold: true, color: C.cyan, breakLine: true, valign: 'top' });
  addText(s, '전환 하락 발견 → 과거 사례 비교 → 시험안 작성 → 담당자 승인 → 결정 기록 → AI 비용 확인', 0.8, 4.44, 7.75, 0.78, { fontSize: 12.5, color: 'D6E0E6', valign: 'top' });
  s.addShape(pptx.ShapeType.line, { x: 0.8, y: 5.42, w: 7.75, h: 0, line: { color: '40515B', width: 1 } });
  addText(s, '30분 세션', 0.8, 5.72, 1.4, 0.34, { fontSize: 11, bold: true, color: C.white });
  addText(s, '본편 8분  ·  화면 시연 10분  ·  마무리 4분  ·  질의응답 8분', 2.05, 5.72, 6.45, 0.34, { fontSize: 10.5, color: 'B7C5CD' });
  addText(s, '2026.08.27 · Seoul', 6.2, 6.55, 2.35, 0.26, { fontSize: 9, color: '82949E', align: 'right' });
  addNotes(s, 1, '0:30', ['“오늘 보여드릴 것은 또 하나의 보고서가 아니라, 일주일 걸리던 성장 의사결정을 점심 전에 끝내는 운영 제품입니다.”', '성장 책임자에게는 결제 완료율 회복, 재무 책임자에게는 AI 비용 확인과 통제가 핵심이라고 설명한다.', '문제 발견부터 시험안 승인과 결정 기록까지의 흐름을 예고한다.']);
}

// 2
{
  const s = pptx.addSlide('NIMBUS');
  title(s, 'NIMBUS 소개', '1,500만 명의 일상을 연결하는 모바일 서비스', '온라인 쇼핑과 영상 서비스를 하나의 앱에서 제공하는 약 400명 규모의 성장 기업입니다.');
  card(s, 0.65, 2.08, 3.75, 2.25, '월간 활성 사용자', '1,500만', '모바일 중심 고객 기반', C.blue);
  card(s, 4.78, 2.08, 3.75, 2.25, '연간 온라인 매출', '4억 달러', '온라인 쇼핑 + 영상 서비스', C.green);
  card(s, 8.91, 2.08, 3.75, 2.25, '조직 규모', '~400', '성장 · 제품 · 데이터 · 재무', C.orange);
  s.addShape(pptx.ShapeType.roundRect, { x: 0.72, y: 4.93, w: 11.88, h: 1.08, rectRadius: 0.08, fill: { color: C.dark }, line: { color: C.dark } });
  addText(s, '성장의 핵심은 더 많은 보고서가 아니라, 고객 행동 변화를 더 빨리 결정으로 바꾸는 것입니다.', 1.02, 4.93, 11.28, 1.08, { fontSize: 19, bold: true, color: C.white, align: 'center' });
  addNotes(s, 2, '0:40', ['“Nimbus는 1,500만 명의 고객이 온라인 쇼핑과 영상 서비스를 이용하는 모바일 중심 기업입니다.”', '약 4억 달러의 온라인 매출과 약 400명 규모의 조직이라는 사업 맥락을 먼저 설명한다.', '오늘의 주제는 분석 도구가 아니라 고객 행동 변화를 더 빠른 실행 결정으로 연결하는 방법이라고 설명한다.']);
}

// 3
{
  const s = pptx.addSlide('NIMBUS');
  title(s, '확인된 문제', '일부 고객의 결제 완료율이 크게 떨어졌습니다', 'Gen-Z와 Android 고객을 포함한 약 40개 고객군이 정상 고객군보다 빠르게 하락했습니다.');
  card(s, 0.65, 2.08, 3.75, 2.25, '정상 고객군', '~4.0%', '평균 결제 완료율', C.green);
  card(s, 4.78, 2.08, 3.75, 2.25, '하락 고객군', '~2.8%', '원인은 아직 확인 중', C.red);
  card(s, 8.91, 2.08, 3.75, 2.25, '연간 예상 손실 위험', '약 1,000만 달러', '약 40개 고객군 합계', C.red);
  addText(s, '하락은 보였지만, 실행 가능한 결정까지 일주일이 걸렸습니다.', 0.68, 4.92, 8.2, 0.46, { fontSize: 21, bold: true });
  addText(s, '문제 발견 → 과거 사례 검색 → 해결안 비교 → 담당자 승인 → 실행 준비가 서로 다른 팀과 도구 사이에서 끊어졌습니다.', 0.7, 5.52, 11.3, 0.52, { fontSize: 13, color: C.muted, valign: 'top' });
  pill(s, '회사 전체: 1%포인트 = 연 400만 달러', 9.08, 4.93, 3.2, C.paleRed, C.red);
  addNotes(s, 3, '0:55', ['“Gen-Z와 Android 고객을 포함한 약 40개 고객군의 결제 완료율이 정상 고객군 4%보다 낮은 약 2.8%로 떨어졌습니다.”', '최근 결제 화면 변경과 비슷한 시기에 하락했지만, 이 사실만으로 원인이라고 단정하지 않는다.', '전체 하락 고객군의 연간 예상 손실 위험은 약 천만 달러이고, 문제는 분석부터 승인까지 일주일이 걸린다는 점이라고 설명한다.']);
}

// 4
{
  const s = pptx.addSlide('NIMBUS');
  title(s, '오늘 제안할 시험', '여러 단계의 결제를 한 화면 간편결제로 바꿉니다', 'Gen-Z / Android 고객 중 25%에게 먼저 보여주고 결제 완료율이 회복되는지 확인합니다.');
  card(s, 0.72, 2.12, 3.72, 2.35, '문제', '4.2% → 2.9%', '구매를 시작한 고객의 결제 완료율 하락', C.red);
  card(s, 4.8, 2.12, 3.72, 2.35, '시험할 변경', '한 화면 간편결제', '여러 화면을 오가던 주문 확인과 결제를 한 화면에서 완료', C.blue);
  card(s, 8.88, 2.12, 3.72, 2.35, '기대 효과', '2.9% → 4.7%', '결제 완료율 1.8%포인트 회복 · 예상 가치 약 72만 달러', C.green);
  s.addShape(pptx.ShapeType.roundRect, { x: 1.62, y: 5.13, w: 10.08, h: 0.82, rectRadius: 0.08, fill: { color: C.paleGreen }, line: { color: 'B9DDCD', width: 1 } });
  addText(s, '앱은 시험안을 승인·기록  ·  제품팀이 실제 시험을 시작', 1.92, 5.13, 9.48, 0.82, { fontSize: 15, bold: true, color: C.green, align: 'center' });
  addNotes(s, 4, '1:00', ['“시험할 변경은 여러 단계를 거치던 주문 확인과 결제를 한 화면에서 끝내는 간편결제입니다.”', '확인된 문제는 Gen-Z / Android 고객의 결제 완료율이 4.2%에서 2.9%로 떨어진 것이며, 원인은 아직 확정되지 않았다.', '비슷한 고객에게 효과가 있었던 접근을 담당자가 승인한 뒤 고객 25%에게 시험한다.', '앱은 시험안을 승인하고 기록하는 곳이며, 실제 고객 화면 변경은 제품팀이 별도로 실행한다.', '효과가 재현되면 결제 완료율 1.8%p 회복과 $721.3K의 가치가 예상된다.']);
}

// 5
{
  const s = pptx.addSlide('NIMBUS');
  title(s, '하나로 연결된 과정', '근거를 찾고 승인한 결정까지 한곳에서 이어집니다', '고객 데이터 → 과거 성공 사례 → 시험안 → 담당자 승인 → 결정 기록 → AI 비용 확인');
  node(s, 0.72, 2.3, 2.45, 1.55, '고객 데이터', '결제 완료율이 떨어진\n고객군 발견', C.blue, true);
  arrow(s, 3.25, 3.08, 4.02, 3.08);
  node(s, 4.08, 2.3, 2.45, 1.55, '과거 사례 찾기', '비슷한 고객에게\n효과가 있었던 시험 검색', C.cyan);
  arrow(s, 6.61, 3.08, 7.38, 3.08);
  node(s, 7.44, 2.3, 2.45, 1.55, '시험안 승인', 'AI가 초안 작성\n담당자가 검토·승인', C.orange);
  arrow(s, 9.97, 3.08, 10.7, 3.08);
  node(s, 10.76, 2.3, 1.85, 1.55, '비용 확인', '사용자별 AI 비용\n한도 초과 차단', C.red);
  s.addShape(pptx.ShapeType.roundRect, { x: 1.18, y: 4.64, w: 10.95, h: 1.15, rectRadius: 0.08, fill: { color: C.pale }, line: { color: 'B8D2E5', width: 1 } });
  addText(s, '하나의 결정 번호가 사용한 근거, AI 초안, 승인자, 기록 시각을 연결합니다.', 1.48, 4.82, 10.35, 0.36, { fontSize: 18, bold: true, align: 'center', color: C.blue });
  addText(s, '원본 고객 데이터는 바꾸지 않고 승인된 시험안만 별도로 기록합니다.', 1.48, 5.25, 10.35, 0.25, { fontSize: 10, color: C.muted, align: 'center' });
  addNotes(s, 5, '0:45', ['“문제 발견, 과거 사례 검색, 시험안 승인, 비용 확인이 하나의 과정으로 이어집니다.”', '고객 데이터와 과거 시험은 읽기만 하고, 앱은 담당자가 승인한 시험안을 별도로 기록한다.', '하나의 결정 번호로 어떤 근거를 사용했고 누가 언제 승인했는지 확인할 수 있다고 설명한다.']);
}

// 6
{
  const s = pptx.addSlide('NIMBUS');
  title(s, '데이터 보호와 책임', '원본 데이터는 보호하고, 승인된 결정만 기록합니다', '분석 데이터, 사람의 승인, AI 비용을 분리해 실수와 무단 실행을 막습니다.');
  node(s, 0.55, 2.35, 2.05, 1.15, '분석 원본', '고객군 · 과거 시험\n추천 자료', C.blue, true);
  node(s, 3.05, 2.35, 2.18, 1.15, '빠른 검색용 사본', '원본을 바꾸지 않고\n읽기만 허용', C.cyan);
  node(s, 5.75, 2.35, 2.18, 1.15, 'Nimbus 앱', '근거 확인 + AI 초안\n담당자 승인', C.orange);
  node(s, 8.45, 2.35, 2.25, 1.15, 'AI 이용 통제', '사용자 확인\n비용 한도', C.red);
  node(s, 5.75, 4.15, 2.18, 1.15, '결정 기록', '시험안 · 승인자\n기록 시각', C.green);
  node(s, 8.45, 4.15, 2.25, 1.15, '비용 화면', '사용량 · 요청자\n차단 결과', C.blue);
  arrow(s, 2.6, 2.93, 3.05, 2.93);
  arrow(s, 5.23, 2.93, 5.75, 2.93);
  arrow(s, 7.93, 2.93, 8.45, 2.93, C.red);
  arrow(s, 6.84, 3.5, 6.84, 4.15, C.green);
  arrow(s, 9.58, 3.5, 9.58, 4.15, C.blue);
  s.addShape(pptx.ShapeType.roundRect, { x: 11.15, y: 2.35, w: 1.55, h: 2.95, rectRadius: 0.08, fill: { color: C.paleGreen }, line: { color: 'B9DDCD' } });
  addText(s, '승인 과정', 11.3, 2.58, 1.25, 0.3, { fontSize: 10, bold: true, color: C.green, align: 'center' });
  addText(s, '시험안\n↓\n담당자 승인\n↓\n결정 기록', 11.3, 3.03, 1.25, 1.58, { fontSize: 13, bold: true, color: C.ink, align: 'center', breakLine: true });
  addText(s, '승인 없이는 기록 불가', 11.24, 4.72, 1.37, 0.3, { fontSize: 8.5, color: C.red, bold: true, align: 'center' });
  addText(s, '하나의 결정 번호로 근거 · 승인자 · AI 비용을 연결', 2.35, 5.68, 8.55, 0.42, { fontSize: 17, bold: true, color: C.blue, align: 'center' });
  addNotes(s, 6, '1:10', ['“원본 고객 데이터, 승인된 결정, AI 비용은 서로 분리해 보호합니다.”', '분석 원본과 검색용 사본은 읽기만 허용하고, 앱은 승인된 시험안만 별도 공간에 기록한다.', 'AI는 초안만 만들며 담당자의 승인 없이는 최종 결정으로 기록할 수 없다.', '기술 상세는 부록에서 테이블명과 API로 확인할 수 있다고 안내한다.']);
}

// 7
{
  const s = pptx.addSlide('NIMBUS');
  title(s, 'WHY DATABRICKS', '하나의 데이터·AI 플랫폼으로 더 빠르고 지속 가능하게 운영합니다', 'One governed platform. One control plane for AI cost.');
  const stages = [
    ['01', '문제를 빠르게 발견', ['최신 상태를 지속적으로 반영', '결제 완료율 하락과 영향 고객 확인'], 'Lakeflow · 공통 지표 · Lakebase 동기화', C.blue],
    ['02', '자연어로 쉽게 분석', ['“어떤 고객의 결제 완료율이\n왜 떨어졌는가?”라고 질문', '대시보드와 Genie가 같은 정의로 답변'], 'AI/BI · Genie · Metric View', C.cyan],
    ['03', '적은 운영 부담으로 실행', ['과거 사례 → AI 시험안 → 담당자 승인', '관리형 서비스와 유휴 시 축소'], 'Databricks Apps · Lakebase', C.orange],
    ['04', '데이터와 AI를 함께 통제', ['접근 권한·보호·추적성을 일관되게 적용', '사용자별 비용 확인·예산 초과 차단'], 'Unity Catalog · Unity AI Gateway', C.red],
  ];
  stages.forEach(([n, heading, bullets, products, accent], i) => {
    const x = 0.58 + i * 3.17;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 2.03, w: 2.82, h: 3.5, rectRadius: 0.08, fill: { color: C.white }, line: { color: accent, width: 1.2 } });
    s.addShape(pptx.ShapeType.ellipse, { x: x + 0.18, y: 2.22, w: 0.48, h: 0.48, fill: { color: accent }, line: { color: accent } });
    addText(s, n, x + 0.18, 2.22, 0.48, 0.48, { fontSize: 9, bold: true, color: C.white, align: 'center' });
    addText(s, heading, x + 0.2, 2.86, 2.42, 0.56, { fontSize: 15, bold: true, color: C.ink, valign: 'top' });
    addText(s, `• ${bullets[0]}\n\n• ${bullets[1]}`, x + 0.2, 3.55, 2.42, 1.25, { fontSize: 10.2, color: C.muted, breakLine: true, valign: 'top', breakLineOnOverflow: false });
    s.addShape(pptx.ShapeType.line, { x: x + 0.2, y: 4.93, w: 2.42, h: 0, line: { color: C.line, width: 0.8 } });
    addText(s, products, x + 0.2, 5.02, 2.42, 0.3, { fontSize: 8.2, bold: true, color: accent, align: 'center' });
    if (i < stages.length - 1) arrow(s, x + 2.85, 3.76, x + 3.12, 3.76, C.line);
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 0.86, y: 5.86, w: 11.6, h: 0.64, rectRadius: 0.08, fill: { color: C.dark }, line: { color: C.dark } });
  addText(s, '도구 간 연결과 수작업 인계를 줄여, 적은 인원으로 더 빠른 의사결정과 예측 가능한 비용 운영이 가능합니다.', 1.12, 5.86, 11.08, 0.64, { fontSize: 13.5, bold: true, color: C.white, align: 'center' });
  addText(s, '앱은 승인된 결정을 기록하고, 실제 고객 대상 실행은 제품팀이 담당합니다.', 1.12, 6.6, 11.08, 0.25, { fontSize: 8.8, color: C.muted, align: 'center' });
  addNotes(s, 7, '0:55', ['“Databricks의 가치는 제품 목록이 아니라 문제 발견부터 비용 통제까지 하나의 운영 흐름으로 이어지는 데 있습니다.”', '최신 상태를 지속적으로 반영하고, 같은 지표 정의를 대시보드와 Genie가 함께 사용해 자연어 분석 부담을 낮춘다.', '관리형 서비스와 유휴 시 축소로 운영 부담을 줄이고, 앱은 담당자가 승인한 결정만 기록하며 실제 실행은 제품팀이 담당한다.', 'Unity Catalog는 데이터와 AI 자산의 접근·보호·추적성을, Unity AI Gateway는 AI 사용량·비용과 예산 초과 차단을 담당한다고 구분해 설명한다.']);
}

// 8
{
  const s = pptx.addSlide('NIMBUS');
  s.background = { color: C.dark };
  addCustomerLogo(s, true);
  addText(s, '실제 화면 시연', 0.75, 0.72, 2.3, 0.3, { fontSize: 10, bold: true, color: C.red, charSpacing: 2 });
  addText(s, '찾기  →  비교하기  →  승인·기록하기', 0.75, 1.55, 11.4, 0.75, { fontSize: 38, bold: true, color: C.white, align: 'center' });
  const items = [
    ['01', '찾기', '결제 완료율이 떨어진 고객군과 관련 자료를 찾습니다'],
    ['02', '비교하기', '과거 성공 사례와 가능한 해결 방법을 비교합니다'],
    ['03', '승인·기록하기', '담당자가 25% 시험안을 승인하고 결정으로 기록합니다'],
  ];
  items.forEach(([n, h, d], i) => {
    const x = 0.85 + i * 4.15;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 3.0, w: 3.65, h: 1.95, rectRadius: 0.08, fill: { color: i === 1 ? '203B47' : '19262D' }, line: { color: i === 1 ? C.cyan : '31434C', width: 1.2 } });
    addText(s, n, x + 0.2, 3.16, 0.5, 0.3, { fontSize: 10, bold: true, color: C.cyan });
    addText(s, h, x + 0.2, 3.58, 3.2, 0.42, { fontSize: 22, bold: true, color: C.white });
    addText(s, d, x + 0.2, 4.1, 3.2, 0.52, { fontSize: 10.5, color: 'B7C5CD', valign: 'top' });
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 5.08, y: 5.28, w: 3.17, h: 1.78, rectRadius: 0.08, fill: { color: C.white }, line: { color: 'DCE1E7', transparency: 35, width: 0.8 } });
  s.addImage({ path: customerLogo, x: 5.23, y: 5.38, w: 2.87, h: 1.58, sizing: { type: 'contain', w: 2.87, h: 1.58 }, altText: 'Nimbus customer logo' });
  addText(s, 'Nimbus Growth Desk 앱', 0.9, 6.05, 3.5, 0.3, { fontSize: 9.5, color: '82949E', align: 'center' });
  addText(s, 'AI 사용량·비용 화면', 8.92, 6.05, 3.5, 0.3, { fontSize: 9.5, color: '82949E', align: 'center' });
  addNotes(s, 8, '전환 0:15 + 라이브 10:00', ['“이제 문제를 찾고 시험안을 승인해 기록하는 실제 흐름을 보여드리겠습니다.”', '앱에서 하락 고객군 찾기, 과거 성공 사례 비교, AI 시험안 확인, 담당자 승인을 차례로 실행한다.', '승인자와 기록 시각이 즉시 남는 것을 보여준 뒤 AI 사용량과 비용 화면을 연다.', '앱이 고객 화면을 직접 변경하는 것은 아니며, 승인된 시험안은 제품팀이 실행한다고 분명히 설명한다.']);
}

// 9
{
  const s = pptx.addSlide('NIMBUS');
  title(s, 'AI 비용 관리', '누가 얼마나 사용했고, 어디서 차단됐는지 확인합니다', 'AI 사용량, 계산한 예상 비용, 한도 초과 차단 결과를 한 화면에서 확인합니다.');
  card(s, 0.65, 2.05, 2.75, 1.86, '예상 사용 비용', '$0.0976', '사용량과 명시된 단가로 계산', C.blue);
  card(s, 3.58, 2.05, 2.75, 1.86, 'AI 요청 횟수', '55건', '처리한 텍스트 양 414,600 토큰', C.blue);
  card(s, 6.51, 2.05, 2.75, 1.86, '한도 초과 차단', '3건', '요청별 차단 기록 보관', C.red);
  card(s, 9.44, 2.05, 2.75, 1.86, '알림 / 사용 중단', '$0.03 / $0.05', '시연용 한도', C.orange);
  node(s, 0.68, 4.55, 3.56, 1.3, '비용을 본다', '시간별 예상 비용\nAI 모델별 사용량', C.blue);
  node(s, 4.86, 4.55, 3.56, 1.3, '사용자를 찾는다', '어떤 앱에서\n누가 요청했는지 확인', C.green);
  node(s, 9.04, 4.55, 3.56, 1.3, '초과 사용을 막는다', '$0.03에서 알림\n$0.05에서 요청 차단', C.red);
  addNotes(s, 9, '1:00', ['“재무 책임자는 AI가 싸다는 약속보다 누가 얼마를 사용했고 어디서 멈췄는지 확인할 수 있어야 합니다.”', '현재 측정된 AI 요청 55건, 총 처리량 414.6K 토큰, 예상 비용 $0.0976, 차단 3건을 보여준다.', '실제 외부 청구액 자료는 제공되지 않았으므로 0이라고 말하지 않고, 사용량과 명시 단가로 계산한 예상 비용이라고 설명한다.', '$0.03과 $0.05는 실제 운영 예산이 아니라 시연을 위해 낮게 설정한 한도라고 설명한다.']);
}

// 10
{
  const s = pptx.addSlide('NIMBUS');
  title(s, '다음 단계', '작게 시험하고, 결과를 보고 확대하거나 중단합니다', '앱에서 승인한 시험안을 제품팀이 실행하고 결제 완료율과 AI 비용을 함께 확인합니다.');
  const cols = [
    ['오늘', '시험안 승인·기록', '담당자가 고객 25% 시험안을 검토하고 승인'],
    ['제품팀 실행', '25% 시험 시작', '한 화면 간편결제를 실제 고객에게 적용'],
    ['24시간', '효과·비용 확인', '결제 완료율, 오류율, AI 사용 비용 점검'],
    ['72시간', '확대 또는 중단', '효과가 있으면 50%로 확대 · 문제 시 중단'],
  ];
  cols.forEach(([h, p, d], i) => {
    const x = 0.65 + i * 3.12;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 2.1, w: 2.72, h: 3.55, rectRadius: 0.08, fill: { color: i === 3 ? C.dark : C.white }, line: { color: i === 3 ? C.dark : C.line, width: 1 } });
    addText(s, `0${i + 1}`, x + 0.2, 2.33, 0.55, 0.34, { fontSize: 10, bold: true, color: i === 3 ? C.cyan : C.red });
    addText(s, h, x + 0.2, 2.92, 2.3, 0.68, { fontSize: 18, bold: true, color: i === 3 ? C.white : C.ink, valign: 'top' });
    pill(s, p, x + 0.2, 3.82, 2.3, i === 3 ? '243039' : C.pale, i === 3 ? C.cyan : C.blue);
    addText(s, d, x + 0.2, 4.42, 2.3, 0.72, { fontSize: 10.5, color: i === 3 ? 'B7C5CD' : C.muted, valign: 'top' });
  });
  addNotes(s, 10, '0:55', ['“앱의 역할은 시험안을 승인하고 기록하는 데까지이며, 실제 고객 화면은 제품팀이 변경합니다.”', '오늘 시험안을 승인하고 제품팀이 고객 25%에게 한 화면 간편결제를 적용한다.', '24시간 동안 결제 완료율, 오류율, AI 비용을 확인하고 72시간 뒤 확대하거나 중단한다.', '성공 기준은 결제 완료율 회복, 안정적인 결제, 통제된 AI 비용, 승인 기록 보존이다.']);
}

// Appendix 11
{
  const s = pptx.addSlide('NIMBUS');
  title(s, '부록 A', '예상 가치의 계산 범위', '회사 전체의 단순 환산값과 이번 고객군의 예상 가치를 구분합니다.');
  node(s, 0.7, 2.0, 5.65, 1.25, '회사 전체', '$400M × 1%p = $4M/년', C.blue);
  node(s, 6.95, 2.0, 5.65, 1.25, '이번 고객군', '예상 총가치 - 실행 비용 = $721.3K 순가치', C.green);
  addText(s, '예상 순가치', 0.78, 3.85, 2.2, 0.34, { fontSize: 13, bold: true });
  addText(s, '= 예상 결제 완료 증가 × 대상 고객 수 × 평균 주문금액 × 관측기간\n  - 시험·개발·운영 비용($5K)', 2.45, 3.72, 9.5, 0.82, { fontSize: 16, bold: true, color: C.ink, breakLine: true });
  addText(s, '주의: +2.25%p는 과거 시험의 실제 결과이고, +1.80%p는 이번 고객군에 대한 예상치입니다.', 0.78, 5.2, 11.25, 0.4, { fontSize: 12, color: C.red, bold: true });
  addText(s, '대시보드의 $0.03/$0.05는 라이브 데모에서 검증한 AI 예산 임계값이며 연간 비용 상한이 아닙니다.', 0.78, 5.78, 11.25, 0.4, { fontSize: 11, color: C.muted });
  addNotes(s, 11, '질문 시 1:00', ['예상 가치의 계산 범위를 묻는 질문에 사용한다.', '$4M은 회사 전체 결제 완료율 1%p의 연간 단순 환산이고, $721.3K는 이번 고객군과 관측기간에 대한 예상 순가치라고 설명한다.', '과거 시험에서 실제로 관측한 효과와 이번 시험의 예상 효과를 구분한다.']);
}

// Appendix 12
{
  const s = pptx.addSlide('NIMBUS');
  title(s, '부록 B', 'AI 초안과 사람의 승인을 분리합니다', 'AI는 시험안을 작성할 뿐이며, 담당자 승인 없이는 최종 결정으로 기록할 수 없습니다.');
  const states = [
    ['1', '시험안 작성', 'AI 초안 + 사용한 근거\n(proposed)', C.orange],
    ['2', '담당자 승인', '로그인한 승인자 기록\n(approved)', C.green],
    ['3', '최종 결정 기록', '승인자와 시각 저장\n(committed)', C.red],
  ];
  states.forEach(([n, h, d, color], i) => {
    const x = 0.8 + i * 4.15;
    s.addShape(pptx.ShapeType.ellipse, { x: x + 1.4, y: 2.0, w: 0.62, h: 0.62, fill: { color }, line: { color } });
    addText(s, n, x + 1.4, 2.0, 0.62, 0.62, { fontSize: 16, bold: true, color: C.white, align: 'center' });
    node(s, x, 2.9, 3.42, 1.55, h, d, color);
    if (i < 2) arrow(s, x + 3.52, 3.67, x + 4.0, 3.67, C.line);
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 1.0, y: 5.1, w: 11.25, h: 0.85, rectRadius: 0.08, fill: { color: C.paleRed }, line: { color: 'F1BDB7' } });
  addText(s, '담당자 승인을 건너뛴 최종 기록은 서버에서 거부 · 모든 과정은 같은 결정 번호에 보관', 1.3, 5.1, 10.65, 0.85, { fontSize: 14, bold: true, color: C.red, align: 'center' });
  addNotes(s, 12, '질문 시 1:15', ['승인 책임과 시스템 통제 질문에 사용한다.', 'AI는 시험안만 만들고 로그인한 담당자가 승인한 뒤에만 최종 결정 기록이 가능하다.', '승인을 건너뛰려는 요청은 서버가 거부하고 모든 과정은 같은 결정 번호에 보관한다.', '구체적인 API 주소와 상태 코드는 기술 검증 자료에서 확인할 수 있다.']);
}

// Appendix 13
{
  const s = pptx.addSlide('NIMBUS');
  title(s, '부록 C', '어떤 데이터를 읽고 무엇을 기록하는가', '고객과 과거 시험 데이터는 읽기만 하고, 앱은 승인된 결정만 별도 공간에 기록합니다.');
  s.addTable([
    [{ text: '동작', options: { bold: true } }, { text: '대상', options: { bold: true } }, { text: '허용 범위', options: { bold: true } }, { text: '기술 확인 정보', options: { bold: true } }],
    ['고객군 조회', '결제 완료율과 고객 특성', '읽기만 가능', 'nimbus_serving.segment_positions'],
    ['과거 사례 검색', '과거 시험 결과', '읽기만 가능', 'app.search_experiments · BM25'],
    ['결정 기록', '승인된 시험안', '새 기록과 상태 변경', 'app.feature_decisions_app'],
    ['시연 초기화', '이번 고객군의 결정 기록', '해당 기록만 삭제', 'segment_id + confirm=true'],
  ], { x: 0.7, y: 2.0, w: 11.9, h: 3.2, border: { type: 'solid', color: C.line, pt: 1 }, fill: C.white, color: C.ink, fontFace: 'Noto Sans KR', fontSize: 12, margin: 0.12, rowH: 0.6, colW: [1.25, 4.15, 2.5, 4.0], bold: false, valign: 'mid', autoFit: false, fillHeader: C.dark });
  addText(s, '고객 원본 데이터는 변경하지 않음 · 시연 초기화도 이번 고객군의 결정 기록만 삭제', 0.75, 5.75, 11.6, 0.4, { fontSize: 13, bold: true, color: C.red, align: 'center' });
  addNotes(s, 13, '질문 시 1:00', ['데이터 보호와 초기화 안전성을 묻는 질문에 사용한다.', '고객군과 과거 시험 데이터는 읽기만 하며 앱은 승인된 결정만 별도 테이블에 기록한다.', '시연 초기화는 지정된 고객군의 앱 작성 기록만 삭제하고 원본 데이터는 변경하지 않는다.']);
}

// Appendix 14
{
  const s = pptx.addSlide('NIMBUS');
  title(s, '부록 D', 'AI 비용 숫자를 어떻게 해석하는가', '계산한 예상 비용, 사용자별 사용량, 차단 결과, 실제 청구액을 서로 구분합니다.');
  const rows = [
    ['예상 비용', '입력 사용량 × 단가 + 출력 사용량 × 단가', '실제 청구액이 아닌 계산값'],
    ['사용자 확인', '앱 이름 + 요청자 + 요청 번호', '누가 사용했는지 추적'],
    ['사용 한도', '$0.03에서 알림 / $0.05에서 중단', '시연용으로 낮춘 한도'],
    ['차단 결과', '한도 초과 요청 거부', '현재 3건 확인'],
    ['실제 청구액', '외부 제공사의 청구 자료', '자료가 없으면 0이 아닌 미제공'],
  ];
  s.addTable([[{ text: '통제', options: { bold: true } }, { text: '구현', options: { bold: true } }, { text: '표시 원칙', options: { bold: true } }], ...rows], { x: 0.72, y: 1.95, w: 11.85, h: 3.7, border: { type: 'solid', color: C.line, pt: 1 }, fill: C.white, color: C.ink, fontFace: 'Noto Sans KR', fontSize: 12, margin: 0.13, rowH: 0.58, colW: [2.0, 5.35, 4.5], valign: 'mid', autoFit: false });
  addText(s, '예상 비용과 실제 청구액을 섞지 않고, 자료가 없으면 “미제공”으로 표시합니다.', 0.76, 6.0, 11.5, 0.42, { fontSize: 14, bold: true, color: C.blue, align: 'center' });
  addNotes(s, 14, '질문 시 1:15', ['AI 비용 계산과 통제 질문에 사용한다.', '사용량과 명시 단가로 계산한 예상 비용을 외부 제공사의 실제 청구액과 섞지 않는다.', '현재 차단 3건은 요청 번호와 함께 확인할 수 있다고 설명한다.', '구체적인 필드명과 상태 코드는 제출 증거에서 확인할 수 있다.']);
}

// Appendix 15
{
  const s = pptx.addSlide('NIMBUS');
  title(s, '부록 E', '예상 질문과 짧은 답변', '정확성, 승인 책임, 비용, 확장성 질문에 확인 가능한 근거로 답합니다.');
  const qs = [
    ['“AI가 틀리면?”', 'AI는 시험안만 작성합니다. 사용한 근거를 담당자가 확인하고 승인합니다.'],
    ['“승인을 건너뛸 수 있나?”', '아니요. 담당자 승인이 없으면 서버가 최종 결정 기록을 거부합니다.'],
    ['“AI 비용이 급증하면?”', '사용자를 확인하고 $0.03에서 알림, $0.05에서 요청을 차단합니다.'],
    ['“실제 청구액이 0인가?”', '아닙니다. 실제 청구 자료가 없으므로 “미제공”이며 예상 비용과 구분합니다.'],
    ['“다른 고객군에도 쓸 수 있나?”', '같은 과정을 반복할 수 있지만 시연 초기화는 이번 고객군에만 허용합니다.'],
  ];
  qs.forEach(([q, a], i) => {
    const y = 1.85 + i * 0.92;
    addText(s, q, 0.75, y, 2.65, 0.58, { fontSize: 13, bold: true, color: i === 2 ? C.red : C.blue });
    s.addShape(pptx.ShapeType.line, { x: 3.35, y: y + 0.29, w: 0.55, h: 0, line: { color: C.line, width: 1.4 } });
    addText(s, a, 4.05, y, 8.15, 0.58, { fontSize: 12, color: C.ink, valign: 'mid' });
  });
  addNotes(s, 15, '질문 시 필요 항목만', ['질문을 받은 항목만 짧게 사용한다.', '주장보다 승인 기록, AI 사용 내역, 데이터 보호 범위처럼 확인 가능한 근거로 답한다.', '더 깊은 기술 질문은 QA_OBJECTIONS_KO.md를 참조한다.']);
}

// Appendix 16
{
  const s = pptx.addSlide('NIMBUS');
  title(s, '부록 F', 'Why Databricks — 주장과 증거', '각 비즈니스 주장에 프로젝트 증거와 공식 제품 책임 범위를 연결합니다.');
  const rows = [
    ['하나의 지표 정의', 'Unity Catalog Metric View', '대시보드·Genie·앱이 같은 전환율 정의 사용'],
    ['최신 상태 반영', 'Lakeflow + Lakebase', '동기화된 고객 상태와 앱 최신 화면'],
    ['자연어 분석', 'AI/BI Genie', '자연어 질문과 데이터 기반 답변'],
    ['사람 중심 실행', 'Databricks Apps + Lakebase', '시험안 → 담당자 승인 → 결정 기록'],
    ['AI 비용 통제', 'Unity AI Gateway', '요청자·사용량·비용·차단 3건 증거'],
    ['경제적인 운영', '관리형 서비스 + scale-to-zero', 'Lakebase 유휴 시 축소 및 AI 예산 한도'],
  ];
  s.addTable([[{ text: '주장', options: { bold: true } }, { text: 'Databricks 기능', options: { bold: true } }, { text: '프로젝트 증거', options: { bold: true } }], ...rows], { x: 0.68, y: 1.82, w: 11.96, h: 3.52, border: { type: 'solid', color: C.line, pt: 1 }, fill: C.white, color: C.ink, fontFace: 'Noto Sans KR', fontSize: 10.5, margin: 0.1, rowH: 0.5, colW: [2.1, 3.25, 6.61], valign: 'mid', autoFit: false });
  addText(s, '공식 출처', 0.72, 5.56, 1.0, 0.24, { fontSize: 9, bold: true, color: C.red });
  const sources = [
    ['Unity Catalog', 'https://docs.databricks.com/data-governance/unity-catalog/'],
    ['Genie', 'https://docs.databricks.com/genie/'],
    ['Databricks Apps', 'https://docs.databricks.com/dev-tools/databricks-apps/'],
    ['Lakebase', 'https://docs.databricks.com/oltp/projects'],
    ['AI governance', 'https://docs.databricks.com/ai-gateway/ai-governance/'],
  ];
  sources.forEach(([label, url], i) => addText(s, label, 1.78 + i * 2.12, 5.52, 1.78, 0.3, { fontSize: 8.7, color: C.blue, underline: { color: C.blue }, hyperlink: { url }, align: 'center' }));
  s.addShape(pptx.ShapeType.roundRect, { x: 0.88, y: 6.02, w: 11.56, h: 0.62, rectRadius: 0.08, fill: { color: C.pale }, line: { color: 'B8D2E5' } });
  addText(s, '데이터·AI 자산 거버넌스는 Unity Catalog, AI 사용량·비용 통제는 Unity AI Gateway가 담당합니다.', 1.12, 6.02, 11.08, 0.62, { fontSize: 12.5, bold: true, color: C.blue, align: 'center' });
  addNotes(s, 16, '질문 시 1:15', ['Why Databricks 슬라이드의 각 주장에 어떤 기능과 프로젝트 증거가 연결되는지 묻는 질문에 사용한다.', '같은 전환율 정의, 동기화된 고객 상태, Genie 자연어 답변, 사람 승인 기록, Gateway의 비용·차단 증거를 차례로 설명한다.', '경제성은 검증되지 않은 절감액이 아니라 관리형 운영, Lakebase 유휴 시 축소, AI 예산 통제로 설명한다.', '하단 공식 출처 링크에서 각 제품의 책임 범위를 확인할 수 있다.']);
}

const notesMd = ['# Nimbus Growth Desk 발표자 노트', '', '> 대상: Sofia Marchetti(VP Growth), Noor Haddad(Head of Finance) · 본편 8분 + 라이브 10분 + 마무리 4분 + Q&A 8분', ''];
for (const n of notes) {
  notesMd.push(`## ${n.number}. ${n.title}`, '', `권장 시간: **${n.time}**`, '', ...n.body.map((line) => `- ${line}`), '');
}
writeFileSync(new URL('SPEAKER_NOTES_KO.md', outDir), `${notesMd.join('\n')}\n`);
await pptx.writeFile({ fileName: new URL('Nimbus_Growth_Desk_Final_KO.pptx', outDir).pathname });
console.log(new URL('Nimbus_Growth_Desk_Final_KO.pptx', outDir).pathname);
