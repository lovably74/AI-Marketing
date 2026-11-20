// node:sqlite 최소 타입 선언. 프로젝트의 @types/node(20.x)에는 node:sqlite 타입이 없다.
// 실제 런타임은 Node 22.5+ 내장 모듈. @types/node를 22+로 올리면 이 파일은 지워도 된다.
declare module "node:sqlite" {
  type SQLInputValue = null | number | bigint | string | Uint8Array;
  interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }
  class StatementSync {
    run(...params: SQLInputValue[]): StatementResultingChanges;
    get(...params: SQLInputValue[]): Record<string, unknown> | undefined;
    all(...params: SQLInputValue[]): Record<string, unknown>[];
  }
  class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; readOnly?: boolean; enableForeignKeyConstraints?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
