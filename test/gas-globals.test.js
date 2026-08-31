import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * GAS는 gas/의 모든 파일이 하나의 전역 스코프를 공유한다.
 * 최상위 const/let 이름이 겹치면 로드 시점 SyntaxError로 Web App 전체가 죽는다.
 * (function 선언은 재선언이 허용되므로 여기서 막지 않는다.)
 *
 * var도 같은 이름의 const/let과 부딪치면 같은 이유로 죽는다. 다른 파일의
 * 전역을 빌려 쓰는 module 가드가 `var X = require(...)` 꼴이라 실수하기 쉽다.
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

  it('var 이름이 다른 파일의 최상위 const/let과 겹치지 않는다', () => {
    // module 가드 안의 `var X = require(...)`는 GAS에서도 X를 전역에 선언한다.
    // 다른 파일이 같은 이름을 const로 잡고 있으면 Web App 전체가 로드에 실패한다.
    const lexical = {};
    const vars = {};

    gasFiles().forEach((file) => {
      const src = fs.readFileSync(file, 'utf8');
      const name = path.basename(file);
      let m;
      const lex = /^(?:const|let)\s+([A-Za-z0-9_$]+)/gm;
      while ((m = lex.exec(src))) lexical[m[1]] = name;
      const v = /(?:^|[^.\w])var\s+([A-Za-z0-9_$]+)/gm;
      while ((m = v.exec(src))) (vars[m[1]] = vars[m[1]] || []).push(name);
    });

    const clashes = Object.keys(vars)
      .filter((n) => lexical[n] && vars[n].some((f) => f !== lexical[n]))
      .map((n) => n + ': var in ' + vars[n].join(', ') + ' / const in ' + lexical[n]);
    expect(clashes).toEqual([]);
  });

  it('lib 파일은 module 가드로 Node에서 import된다', () => {
    gasFiles()
      .filter((f) => f.includes(path.sep + 'lib' + path.sep))
      .forEach((f) => {
        expect(fs.readFileSync(f, 'utf8')).toContain("typeof module !== 'undefined'");
      });
  });
});
