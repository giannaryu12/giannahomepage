import { describe, it, expect } from 'vitest';
import {
  PROGRESS_AREAS,
  PROGRESS_FIELDS,
  TEST_AREAS,
  TEST_FIELDS,
  NEXT_FIELDS,
  BOOK_FIELDS,
  RECORD_AREA_FIELDS,
  areaLines,
  areaSummary,
  nextLines,
  testLines,
} from '../public/assets/js/progress-areas.js';

describe('PROGRESS_AREAS', () => {
  it('단어·독해·문법·듣기·기타 다섯 영역을 이 순서로 갖는다', () => {
    expect(PROGRESS_AREAS.map((a) => a.key)).toEqual(
      ['vocab', 'reading', 'grammar', 'listening', 'etc']
    );
    expect(PROGRESS_AREAS.map((a) => a.label)).toEqual(
      ['단어', '독해', '문법', '듣기', '기타']
    );
  });

  it('영역마다 교재·진도 필드 이름이 짝지어져 10개가 된다', () => {
    expect(PROGRESS_FIELDS).toEqual([
      'vocabBook', 'vocabProgress',
      'readingBook', 'readingProgress',
      'grammarBook', 'grammarProgress',
      'listeningBook', 'listeningProgress',
      'etcBook', 'etcProgress',
    ]);
  });
});

describe('areaLines', () => {
  it('진도가 있는 영역만 돌려준다', () => {
    const lines = areaLines({
      vocabBook: '능률보카', vocabProgress: 'Day 12',
      readingBook: '리딩튜터', readingProgress: 'Unit 5',
      grammarBook: '', grammarProgress: '',
    });
    expect(lines.map((l) => l.label)).toEqual(['단어', '독해']);
    expect(lines[0]).toEqual({ key: 'vocab', label: '단어', book: '능률보카', progress: 'Day 12' });
  });

  it('교재만 있고 진도가 비면 내보내지 않는다', () => {
    // 교재는 그 학생이 쓰는 책이라 매번 미리 채워지지만, 그날 그 영역을
    // 했다는 뜻은 아니다. 학부모 화면에 "독해 — 리딩튜터"만 뜨면 오해한다.
    expect(areaLines({ readingBook: '리딩튜터', readingProgress: '' })).toEqual([]);
  });

  it('진도만 있고 교재가 비어도 내보낸다', () => {
    const lines = areaLines({ etcProgress: '영어 일기' });
    expect(lines).toEqual([{ key: 'etc', label: '기타', book: '', progress: '영어 일기' }]);
  });

  it('공백만 있는 값은 빈 것으로 본다', () => {
    expect(areaLines({ vocabProgress: '   ' })).toEqual([]);
  });

  it('레코드가 없거나 비어도 빈 배열이다', () => {
    expect(areaLines(null)).toEqual([]);
    expect(areaLines({})).toEqual([]);
  });

  it('영역 순서는 항상 단어→독해→문법→듣기→기타다', () => {
    const lines = areaLines({ etcProgress: 'E', vocabProgress: 'V', grammarProgress: 'G' });
    expect(lines.map((l) => l.label)).toEqual(['단어', '문법', '기타']);
  });
});

describe('areaSummary', () => {
  it('영역명과 진도를 가운뎃점으로 이어 붙인다', () => {
    expect(areaSummary({ vocabProgress: 'Day 12', readingProgress: 'Unit 5' }))
      .toBe('단어 Day 12 · 독해 Unit 5');
  });

  it('영역 진도가 하나도 없으면 옛 progress 값으로 되돌아간다', () => {
    // 영역 구분이 생기기 전에 쌓인 기록이다. 학부모 화면에서 사라지면 안 된다.
    expect(areaSummary({ progress: 'Unit 7 전체' })).toBe('Unit 7 전체');
  });

  it('영역 진도가 있으면 옛 progress는 쓰지 않는다', () => {
    expect(areaSummary({ progress: '옛것', vocabProgress: 'Day 1' })).toBe('단어 Day 1');
  });

  it('둘 다 없으면 빈 문자열이다', () => {
    expect(areaSummary({})).toBe('');
    expect(areaSummary(null)).toBe('');
  });
});

describe('TEST_AREAS / NEXT_FIELDS', () => {
  it('시험은 단어 두 번·문법·듣기 네 영역이다', () => {
    expect(TEST_AREAS.map((a) => a.key)).toEqual(['vocab', 'vocab2', 'grammar', 'listening']);
    expect(TEST_AREAS.map((a) => a.label)).toEqual(['단어1', '단어2', '문법', '듣기']);
  });

  it('시험 영역 key가 서로 겹치지 않는다', () => {
    const keys = TEST_AREAS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('시험 필드는 영역마다 교재·점수·만점 세 개다', () => {
    expect(TEST_FIELDS).toEqual([
      'vocabTestBook', 'vocabTestScore', 'vocabTestMax',
      'vocab2TestBook', 'vocab2TestScore', 'vocab2TestMax',
      'grammarTestBook', 'grammarTestScore', 'grammarTestMax',
      'listeningTestBook', 'listeningTestScore', 'listeningTestMax',
    ]);
  });

  it('숙제 필드는 진도와 같은 다섯 영역에 교재·내용 두 개씩이다', () => {
    expect(NEXT_FIELDS).toEqual([
      'vocabNextBook', 'vocabNext',
      'readingNextBook', 'readingNext',
      'grammarNextBook', 'grammarNext',
      'listeningNextBook', 'listeningNext',
      'etcNextBook', 'etcNext',
    ]);
  });

  it('BOOK_FIELDS는 교재 칸 열네 개를 모두 담는다', () => {
    expect(BOOK_FIELDS).toEqual([
      'vocabBook', 'readingBook', 'grammarBook', 'listeningBook', 'etcBook',
      'vocabNextBook', 'readingNextBook', 'grammarNextBook', 'listeningNextBook', 'etcNextBook',
      'vocabTestBook', 'vocab2TestBook', 'grammarTestBook', 'listeningTestBook',
    ]);
    BOOK_FIELDS.forEach((f) => expect(RECORD_AREA_FIELDS).toContain(f));
  });

  it('RECORD_AREA_FIELDS는 세 묶음을 모두 담고 중복이 없다', () => {
    expect(RECORD_AREA_FIELDS).toEqual([...PROGRESS_FIELDS, ...NEXT_FIELDS, ...TEST_FIELDS]);
    expect(new Set(RECORD_AREA_FIELDS).size).toBe(RECORD_AREA_FIELDS.length);
  });
});

describe('nextLines', () => {
  it('내용이 있는 영역만 진도와 같은 순서로 돌려준다', () => {
    const lines = nextLines({
      etcNext: '영어 일기',
      vocabNextBook: '능률보카', vocabNext: 'Day 14',
    });
    expect(lines).toEqual([
      { key: 'vocab', label: '단어', book: '능률보카', text: 'Day 14' },
      { key: 'etc', label: '기타', book: '', text: '영어 일기' },
    ]);
  });

  it('교재만 있고 내용이 비면 내보내지 않는다', () => {
    // 교재는 미리 채워지므로 그 영역 숙제를 냈다는 뜻이 아니다.
    expect(nextLines({ readingNextBook: '리딩튜터', readingNext: '' })).toEqual([]);
  });

  it('비어 있거나 공백뿐이면 내보내지 않는다', () => {
    expect(nextLines({ vocabNext: '   ', readingNext: '' })).toEqual([]);
    expect(nextLines(null)).toEqual([]);
  });
});

describe('testLines', () => {
  it('점수와 만점이 모두 있는 시험만 돌려준다', () => {
    const lines = testLines({
      vocabTestBook: '워드마스터', vocabTestScore: 18, vocabTestMax: 20,
      listeningTestScore: '', listeningTestMax: '',
    });
    expect(lines).toEqual([
      { key: 'vocab', label: '단어1', book: '워드마스터', score: '18', max: '20', pct: 90 },
    ]);
  });

  it('0점도 기록으로 본다', () => {
    // 0점이 "안 봤음"으로 뭉개지면 학부모가 볼 기록이 사라진다.
    const lines = testLines({ listeningTestScore: 0, listeningTestMax: 10 });
    expect(lines).toEqual([
      { key: 'listening', label: '듣기', book: '', score: '0', max: '10', pct: 0 },
    ]);
  });

  it('교재만 있고 점수가 없으면 내보내지 않는다', () => {
    expect(testLines({ vocabTestBook: '워드마스터' })).toEqual([]);
  });

  it('만점이 0이거나 없으면 내보내지 않는다', () => {
    expect(testLines({ vocabTestScore: 5, vocabTestMax: 0 })).toEqual([]);
    expect(testLines({ vocabTestScore: 5 })).toEqual([]);
  });

  it('여러 시험이 있으면 단어1·단어2·문법·듣기 순서다', () => {
    const lines = testLines({
      listeningTestScore: 8, listeningTestMax: 10,
      grammarTestScore: 7, grammarTestMax: 10,
      vocab2TestScore: 9, vocab2TestMax: 10,
      vocabTestScore: 15, vocabTestMax: 20,
    });
    expect(lines.map((l) => l.label)).toEqual(['단어1', '단어2', '문법', '듣기']);
  });

  it('두 번째 단어 시험은 첫 번째와 따로 기록된다', () => {
    const lines = testLines({
      vocabTestScore: 20, vocabTestMax: 20,
      vocab2TestBook: '어원편', vocab2TestScore: 12, vocab2TestMax: 20,
    });
    expect(lines).toEqual([
      { key: 'vocab', label: '단어1', book: '', score: '20', max: '20', pct: 100 },
      { key: 'vocab2', label: '단어2', book: '어원편', score: '12', max: '20', pct: 60 },
    ]);
  });

  it('문법 시험은 문법 진도·숙제와 다른 칸이다', () => {
    const rec = {
      grammarBook: '문법책', grammarProgress: 'Unit 3',
      grammarNextBook: '워크북', grammarNext: 'p.20',
      grammarTestBook: '문법시험지', grammarTestScore: 14, grammarTestMax: 20,
    };
    expect(testLines(rec)).toEqual([
      { key: 'grammar', label: '문법', book: '문법시험지', score: '14', max: '20', pct: 70 },
    ]);
    expect(areaLines(rec)[0].book).toBe('문법책');
    expect(nextLines(rec)[0].book).toBe('워크북');
  });

  it('레코드가 없으면 빈 배열이다', () => {
    expect(testLines(null)).toEqual([]);
  });
});
