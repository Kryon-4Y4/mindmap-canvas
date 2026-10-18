import { parseMarkdown, serializeMarkdown, findNode, findParent } from "../src/model";
import { computeLayout } from "../src/layout";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL: " + msg);
    process.exit(1);
  }
  console.log("PASS: " + msg);
}

// 1. 解析嵌套列表
const md = "- 中心主题\n\t- 分支一\n\t\t- 子A\n\t\t- 子B\n\t- 分支二\n";
const root = parseMarkdown(md);
assert(root.id === "0", "根节点 id = 0");
assert(root.text === "中心主题", "根节点文本");
assert(root.children.length === 2, "两个一级分支");
assert(root.children[0].id === "0-0", "子节点 id 路径索引");
assert(root.children[0].children[1].text === "子B", "孙节点文本");

// 2. 序列化往返
const out = serializeMarkdown(root);
const root2 = parseMarkdown(out);
assert(JSON.stringify(root2) === JSON.stringify(root), "序列化往返稳定");

// 3. 查找
assert(findNode(root, "0-0-1")?.text === "子B", "findNode");
const p = findParent(root, "0-0");
assert(p?.parent.id === "0" && p.index === 0, "findParent");

// 4. 布局
const layout = computeLayout(root);
assert(layout.rootId === "0", "布局根节点");
assert(layout.nodes.size === 5, "共 5 个节点布局");
assert(layout.nodes.get("0")!.x === 0, "根节点 x=0（居中）");
const c0 = layout.nodes.get("0-0")!;
const c1 = layout.nodes.get("0-1")!;
assert(c0.x < 0 && c1.x > 0, `左右分叉: ${c0.x}, ${c1.x}`);

// 5. 奇数分支（3 个一级分支）也左右对称
const md3 = "- 根\n\t- a\n\t- b\n\t- c\n";
const root3 = parseMarkdown(md3);
const layout3 = computeLayout(root3);
const xs = [layout3.nodes.get("0-0")!.x, layout3.nodes.get("0-1")!.x, layout3.nodes.get("0-2")!.x];
const left = xs.filter((x) => x < 0).length;
const right = xs.filter((x) => x > 0).length;
assert(left === 1 && right === 2, `3 分支拆分: 左 ${left} 右 ${right}`);

console.log("\nALL PASSED");
