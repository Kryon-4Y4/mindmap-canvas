// 思维导图数据模型与类型定义

/** 思维导图节点（树形结构） */
export interface MindNode {
  id: string;
  text: string;
  children: MindNode[];
}

/** 布局后的节点坐标信息（世界坐标，单位 px） */
export interface NodeLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  parentId: string | null;
}

/** 布局结果 */
export interface LayoutResult {
  /** nodeId -> 布局信息 */
  nodes: Map<string, NodeLayout>;
  /** 根节点 id */
  rootId: string;
  /** 整体包围盒（用于居中） */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/** 视图状态（缩放与平移，仅会话内有效） */
export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

export const DEFAULT_VIEW_STATE: ViewState = {
  zoom: 1,
  panX: 0,
  panY: 0,
};
