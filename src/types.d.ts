// 人物与事件的数据契约。项目是纯 JS，这里只给 JSDoc 和 `npm run typecheck` 用，不参与打包。
// 运行时的完整校验仍在 scripts/validate-data.mjs；这里描述的是代码依赖的字段。

export interface SourceRef {
  label?: string;
  url?: string;
  [key: string]: unknown;
}

/** 写在人物目录里的里程碑（extendedCatalog 等用 milestone() 生成） */
export interface Milestone {
  year: number;
  title: string;
  score: number;
  dimension: string;
  summary: string;
}

export interface Trajectory {
  /** 最后一个节点是否为人生终点（终点前曲线收束） */
  terminal?: boolean;
  [key: string]: unknown;
}

/** 归一化之后的人生事件 */
export interface FigureEvent extends Milestone {
  /** 发生时的年龄（data.js 归一化时计算） */
  age?: number;
  /** 0–100 的人生进度 */
  phase?: number;
  /** 相对上一事件的分数变化 */
  delta?: number;
  /** 身后事件不参与人生曲线插值 */
  posthumous?: boolean;
  source?: SourceRef;
  trajectory?: Trajectory;
  [key: string]: unknown;
}

export interface FigureMetrics {
  alliance: number;
  command: number;
  legitimacy: number;
  resilience: number;
}

export interface Figure {
  id: string;
  name: string;
  courtesy?: string;
  camp?: string;
  dynasty: string;
  era?: string;
  domain?: string;
  period?: string;
  born: number;
  died: number;
  lifeSpan?: number;
  thesis?: string;
  dateCertainty?: string;
  events: FigureEvent[];
  color?: string;
  metrics?: FigureMetrics;
  sources?: SourceRef[];
  provenance?: unknown;
  [key: string]: unknown;
}

/** extendedCatalog 里 figure() 的入参 */
export interface FigureSpec {
  id: string;
  name: string;
  courtesy?: string;
  camp?: string;
  dynasty: string;
  era?: string;
  domain?: string;
  born: number;
  died: number;
  birthplace: string;
  thesis?: string;
  milestones: Milestone[];
  source?: SourceRef;
  dateCertainty?: string;
}
