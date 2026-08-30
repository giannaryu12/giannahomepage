import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * GAS는 gas/의 모든 파일이 하나의 전역 스코프를 공유한다.
 * 최상위 const/let 이름이 겹치면 로드 시점 SyntaxError로 Web App 전체가 죽는다.
 * (function 선언은 재선언이 허용되므로 여기서 막지 않는다.)
 */
const root = path.resolve(__dirname, '..', 'gas');

function gasFiles() {
  const out = [];
  const walk = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) out.push(p);
    });
  };
  walk(root);
  return out;
}

describe('GAS 전역 스코프', () => {
  it('최상위 const/let 이름이 파일 사이에서 겹치지 않는다', () => {
    const seen = {};
    gasFiles().forEach((file) => {
      const src = fs.readFileSync(file, 'utf8');
      const re = /^(?:const|let)\s+([A-Za-z0-9_$]+)/gm;
      let m;
      while ((m = re.exec(src))) {
        seen[m[1]] = seen[m[1]] || [];
        seen[m[1]].push(path.basename(file));
      }
    });
    const dups = Object.keys(seen).filter((n) => seen[n].length > 1)
      .map((n) => n + ': ' + seen[n].join(', '));
    expect(dups).toEqual([]);
  });

  it('lib 파일은 module 가드로 Node에서 import된다', () => {
    gasFiles()
      .filter((f) => f.includes(path.sep + 'lib' + path.sep))
      .forEach((f) => {
        expect(fs.readFileSync(f, 'utf8')).toContain("typeof module !== 'undefined'");
      });
  });
});
