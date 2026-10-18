// 思维导图树形布局算法：根节点居中，一级分支左右对称展开
import { MindNode, LayoutResult, NodeLayout } from "./types";

/** 水平间距：父子节点之间的中心距离 */
const H_GAP = 220;
/** 垂直间距：相邻叶子节点之间的中心距离 */
const V_GAP = 46;
/** 节点尺寸估算（渲染后会被真实测量值覆盖） */
const EST_WIDTH = 120;
const EST_HEIGHT = 40;

interface RawLayout {
  node: MindNode;
  x: number;
  y: number;
  depth: number;
}

/**
 * 计算思维导图布局。
 * 根节点位于原点；一级子节点按总高度对半拆分到左右两侧；
 * 每棵子树用“叶子槽位 + 父节点居中”的简洁树布局向右展开。
 */
export function computeLayout(root: MindNode): LayoutResult {
  const nodes = new Map<string, NodeLayout>();
  const raw: Map<string, RawLayout> = new Map();

  // 根节点居中
  raw.set(root.id, { node: root, x: 0, y: 0, depth: 0 });

  const rootChildren = root.children;
  const subtrees: RawLayout[][] = [];

  // 分别布局每棵一级子树（相对坐标，depth 从 1 开始）
  for (const child of rootChildren) {
    const collected: RawLayout[] = [];
    const counter = { n: 0 };
    layoutSubtree(child, 1, counter, collected);
    subtrees.push(collected);
  }

  // 按子树高度在垂直方向累加排列，得到每棵子树的垂直偏移
  const offsets: number[] = [];
  let cursor = 0;
  for (const subtree of subtrees) {
    offsets.push(cursor);
    // 子树高度 = 叶子数 * V_GAP；这里用子树内的节点 y 范围估算
    const leafCount = subtree.filter((r) => r.node.children.length === 0).length;
    cursor += Math.max(1, leafCount) * V_GAP;
  }

  // 左右对半拆分
  const total = subtrees.length;
  const leftCount = Math.floor(total / 2);

  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;

  subtrees.forEach((subtree, i) => {
    const isLeft = i < leftCount;
    const offsetY = offsets[i] - cursor / 2 + V_GAP; // 整体垂直居中
    for (const r of subtree) {
      const x = isLeft ? -r.x : r.x;
      const y = r.y + offsetY;
      raw.set(r.node.id, { node: r.node, x, y, depth: r.depth });
    }
  });

  // 根节点垂直居中于所有一级子节点
  const firstLevel = rootChildren.map((c) => raw.get(c.id));
  const validY = firstLevel
    .map((r) => r?.y)
    .filter((y): y is number => typeof y === "number");
  if (validY.length > 0) {
    const rootY = (Math.min(...validY) + Math.max(...validY)) / 2;
    const r = raw.get(root.id);
    if (r) r.y = rootY;
  }

  // 组装结果并计算包围盒
  for (const [id, r] of raw.entries()) {
    nodes.set(id, {
      x: r.x,
      y: r.y,
      width: EST_WIDTH,
      height: EST_HEIGHT,
      depth: r.depth,
      parentId: findParentId(root, id),
    });
    minX = Math.min(minX, r.x);
    maxX = Math.max(maxX, r.x);
    minY = Math.min(minY, r.y);
    maxY = Math.max(maxY, r.y);
  }

  return {
    nodes,
    rootId: root.id,
    bounds: { minX, minY, maxX, maxY },
  };
}

/**
 * 简洁树布局：叶子节点按递增槽位垂直排列，父节点垂直居中于其子节点。
 */
function layoutSubtree(
  node: MindNode,
  depth: number,
  leafCounter: { n: number },
  out: RawLayout[]
): void {
  let y: number;
  if (node.children.length === 0) {
    y = leafCounter.n * V_GAP;
    leafCounter.n++;
  } else {
    for (const child of node.children) {
      layoutSubtree(child, depth + 1, leafCounter, out);
    }
    // 父节点居中于首尾子节点
    const first = out.find((r) => r.node.id === node.children[0].id);
    const last = out.find(
      (r) => r.node.id === node.children[node.children.length - 1].id
    );
    y = first && last ? (first.y + last.y) / 2 : leafCounter.n * V_GAP;
  }
  out.push({ node, x: depth * H_GAP, y, depth });
}

/** 查找节点 id 对应的父节点 id */
function findParentId(root: MindNode, id: string): string | null {
  if (id === root.id) return null;
  return findParentIdDeep(root, id);
}

function findParentIdDeep(node: MindNode, id: string): string | null {
  for (const child of node.children) {
    if (child.id === id) return node.id;
    const found = findParentIdDeep(child, id);
    if (found !== null) return found;
  }
  return null;
}
