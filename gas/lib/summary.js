/**
 * 학부모 화면 요약 통계. 순수 함수.
 *
 * 집계 규칙
 *  - 출석률: (출석+지각+보강) / 출결이 기록된 건수. 결석만 미출석.
 *  - 제출률: (제출+부분제출) / 해당없음을 뺀 건수.
 *  - 평균점수: score/max*100 의 평균, 점수가 있는 기록만.
 *  - 분모가 0이면 0이 아니라 null. "0%"와 "데이터 없음"은 다르다.
 */

const PRESENT_VALUES = ['출석', '지각', '보강'];
const SUBMITTED_VALUES = ['제출', '부분제출'];

function rate(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 100);
}

function computeSummary(records, monthKey) {
  const list = Array.isArray(records) ? records : [];
  const scoped = monthKey
    ? list.filter(function (r) { return String(r.date || '').slice(0, 7) === monthKey; })
    : list;

  let attTotal = 0, attPresent = 0;
  let hwTotal = 0, hwDone = 0;
  let scoreSum = 0, scoreCount = 0;
  // 묶음별 합계. 단어는 두 시험(vocab·vocab2)이 한 칸에 함께 들어간다.
  const areaSums = {};
  const areaCounts = {};
  const groups = testSummaryGroups_();
  groups.forEach(function (g) { areaSums[g.key] = 0; areaCounts[g.key] = 0; });

  scoped.forEach(function (r) {
    if (r.attendance) {
      attTotal++;
      if (PRESENT_VALUES.indexOf(r.attendance) !== -1) attPresent++;
    }

    if (r.homeworkStatus && r.homeworkStatus !== '해당없음') {
      hwTotal++;
      if (SUBMITTED_VALUES.indexOf(r.homeworkStatus) !== -1) hwDone++;
    }

    const score = Number(r.testScore);
    const max = Number(r.testMax);
    const hasScore = r.testScore !== '' && r.testScore !== null && r.testScore !== undefined;
    if (hasScore && isFinite(score) && isFinite(max) && max > 0) {
      scoreSum += (score / max) * 100;
      scoreCount++;
    }

    groups.forEach(function (g) {
      g.memberKeys.forEach(function (key) {
        const pct = percentOf(r[key + 'TestScore'], r[key + 'TestMax']);
        if (pct === null) return;
        areaSums[g.key] += pct;
        areaCounts[g.key]++;
      });
    });
  });

  const out = {
    attendanceRate: rate(attPresent, attTotal),
    homeworkRate: rate(hwDone, hwTotal),
    // 시험이 영역별로 나뉘기 전에 쌓인 점수. 값이 있을 때만 화면에 낸다.
    avgScore: scoreCount ? Math.round(scoreSum / scoreCount) : null,
    recordCount: scoped.length,
  };

  // 묶음마다 <key>Avg. 기록이 없으면 0이 아니라 null이다.
  groups.forEach(function (g) {
    out[g.key + 'Avg'] = areaCounts[g.key]
      ? Math.round(areaSums[g.key] / areaCounts[g.key]) : null;
  });

  return out;
}

/** score/max를 100점 환산. 기록이 아니면 null. 0점은 기록이다. */
function percentOf(rawScore, rawMax) {
  if (rawScore === '' || rawScore === null || rawScore === undefined) return null;
  const score = Number(rawScore);
  const max = Number(rawMax);
  if (!isFinite(score) || !isFinite(max) || !(max > 0)) return null;
  return (score / max) * 100;
}

if (typeof module !== 'undefined') {
  /* eslint-disable no-var */
  // shape.js 아래쪽 주석과 같은 이유로 const/let이 아니라 var다.
  // GAS는 전역을 공유해 records.js의 testSummaryGroups_를 그냥 쓰고,
  // Node에서는 이 가드 안의 require가 그 이름을 채운다.
  var testSummaryGroups_ = require('./records.js').testSummaryGroups_;
  module.exports = { computeSummary, percentOf, PRESENT_VALUES, SUBMITTED_VALUES };
}
