// 思维导图数据模型：Markdown 嵌套列表 <-> 树形结构的解析与序列化
import { MindNode } from "./types";

const ROOT_TEXT = "中心主题";

/**
 * 计算一行开头的缩进层级。
 * 一个 tab 计 1 级，两个空格计 1 级。
 */
function countIndent(leading: string): number {
  let indent = 0;
  for (let i = 0; i < leading.length; i++) {
    const ch = leading[i];
    if (ch === "\t") {
      indent += 1;
    } else if (ch === " ") {
      indent += 0.5;
    } else {
      break;
    }
  }
  return Math.round(indent);
}

/** 列表项匹配：缩进 + 标记符（- 或 * 或 +）+ 文本 */
const LIST_RE = /^(\s*)([-*+])\s+(.*)$/;

/**
 * 将 Markdown 文本解析为思维导图树。
 * 第一个顶层列表项作为根节点，其余顶层列表项作为根节点的子节点。
 */
export function parseMarkdown(content: string): MindNode {
  const root: MindNode = { id: "0", text: ROOT_TEXT, children: [] };

  // 栈：记录路径上的节点及其缩进层级
  const stack: { node: MindNode; indent: number }[] = [];

  let hasRoot = false;

  for (const line of content.split("\n")) {
    const m = line.match(LIST_RE);
    if (!m) continue;

    const indent = countIndent(m[1]);
    const text = m[3].trim() || " ";

    // 回退栈，找到当前行的父节点
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (!hasRoot) {
      // 第一个顶层项作为根节点
      root.text = text;
      stack.length = 0;
      stack.push({ node: root, indent });
      hasRoot = true;
    } else if (stack.length === 0) {
      // 额外的顶层项，作为根节点的子节点
      const node: MindNode = { id: "", text, children: [] };
      root.children.push(node);
      stack.push({ node, indent });
    } else {
      const parent = stack[stack.length - 1].node;
      const node: MindNode = { id: "", text, children: [] };
      parent.children.push(node);
      stack.push({ node, indent });
    }
  }

  // 统一重建 id：路径索引（结构变化时保持稳定）
  reindex(root, "0");
  return root;
}

/** 按路径索引递归重建 id，如 0、0-0、0-1、0-0-0 */
export function reindex(node: MindNode, prefix: string): void {
  node.id = prefix;
  node.children.forEach((child, i) => reindex(child, `${prefix}-${i}`));
}

/**
 * 将思维导图树序列化为 Markdown 嵌套列表（使用 tab 缩进）。
 */
export function serializeMarkdown(root: MindNode): string {
  const lines: string[] = [];
  const walk = (node: MindNode, depth: number) => {
    const indent = "\t".repeat(depth);
    lines.push(`${indent}- ${node.text}`);
    for (const child of node.children) {
      walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return lines.join("\n") + "\n";
}

/** 创建一个默认的思维导图树 */
export function createDefaultTree(): MindNode {
  const root: MindNode = {
    id: "0",
    text: ROOT_TEXT,
    children: [
      { id: "0-0", text: "分支一", children: [
        { id: "0-0-0", text: "子主题 A", children: [] },
        { id: "0-0-1", text: "子主题 B", children: [] },
      ] },
      { id: "0-1", text: "分支二", children: [] },
      { id: "0-2", text: "分支三", children: [] },
    ],
  };
  return root;
}

/** 按 id 在树中查找节点 */
export function findNode(root: MindNode, id: string): MindNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/** 查找某节点的父节点，返回 { parent, index } 或 null */
export function findParent(
  root: MindNode,
  id: string
): { parent: MindNode; index: number } | null {
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    if (child.id === id) return { parent: root, index: i };
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}
