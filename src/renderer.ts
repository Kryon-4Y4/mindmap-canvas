// 思维导图画布渲染器：负责节点渲染、连线、拖拽、平移、缩放、编辑等交互
import {
  MindNode,
  LayoutResult,
  NodeLayout,
  ViewState,
  DEFAULT_VIEW_STATE,
} from "./types";
import { computeLayout } from "./layout";

/** 渲染器对外回调（数据变更交由 View 处理，渲染器只负责展示与交互） */
export interface MindMapRendererCallbacks {
  onRename(id: string, text: string): void;
  onAddChild(id: string): void;
  onAddSibling(id: string): void;
  onDelete(id: string): void;
  onSelect(id: string | null): void;
}

/** SVG 画布尺寸：足够大以容纳任意世界坐标 */
const SVG_SIZE = 400000;
const SVG_HALF = SVG_SIZE / 2;

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;

/** 拖拽状态 */
interface DragState {
  type: "pan" | "node";
  id?: string;
  startScreenX: number;
  startScreenY: number;
  startWorldX: number;
  startWorldY: number;
  startPanX: number;
  startPanY: number;
  moved: boolean;
}

export class MindMapRenderer {
  private container: HTMLElement;
  private callbacks: MindMapRendererCallbacks;

  private root: MindNode;
  private layout: LayoutResult;
  private selectedId: string | null = null;
  private view: ViewState = { ...DEFAULT_VIEW_STATE };

  // DOM 元素
  private contentEl: HTMLElement;
  private svgEl: SVGSVGElement;
  private nodeLayerEl: HTMLElement;
  private nodeEls = new Map<string, HTMLElement>();

  private drag: DragState | null = null;
  private editingId: string | null = null;

  // 解绑函数
  private disposers: Array<() => void> = [];

  constructor(container: HTMLElement, callbacks: MindMapRendererCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.container.classList.add("mm-canvas");
    this.container.tabIndex = 0;

    // 内容层（受缩放/平移 transform 影响）
    this.contentEl = this.container.createDiv({ cls: "mm-content" });

    // 连线层（SVG）
    this.svgEl = this.contentEl.createSvg("svg", { cls: "mm-edges" });
    this.svgEl.style.left = `${-SVG_HALF}px`;
    this.svgEl.style.top = `${-SVG_HALF}px`;
    this.svgEl.style.width = `${SVG_SIZE}px`;
    this.svgEl.style.height = `${SVG_SIZE}px`;

    // 节点层
    this.nodeLayerEl = this.contentEl.createDiv({ cls: "mm-nodes" });

    // 初始空树
    this.root = { id: "0", text: "中心主题", children: [] };
    this.layout = computeLayout(this.root);

    this.bindEvents();
  }

  // ---------------------------------------------------------------------------
  // 公共 API
  // ---------------------------------------------------------------------------

  setRoot(root: MindNode): void {
    this.root = root;
    // 若选中节点已不存在，取消选中
    if (this.selectedId && !this.findNode(this.root, this.selectedId)) {
      this.selectedId = null;
    }
    this.layout = computeLayout(root);
    this.render();
  }

  getRoot(): MindNode {
    return this.root;
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  select(id: string | null): void {
    this.selectedId = id;
    this.updateSelection();
  }

  /** 缩放（以屏幕坐标 screenX/screenY 为中心） */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    const { zoom, panX, panY } = this.view;
    const worldX = (screenX - panX) / zoom;
    const worldY = (screenY - panY) / zoom;
    const newZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);
    this.view.zoom = newZoom;
    this.view.panX = screenX - worldX * newZoom;
    this.view.panY = screenY - worldY * newZoom;
    this.applyTransform();
  }

  zoomIn(): void {
    const rect = this.container.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, 1.2);
  }

  zoomOut(): void {
    const rect = this.container.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, 1 / 1.2);
  }

  resetZoom(): void {
    this.view = { ...DEFAULT_VIEW_STATE };
    this.fitView();
  }

  /** 自适应：将整幅导图居中并缩放到合适大小 */
  fitView(): void {
    const { bounds } = this.layout;
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    const pad = 160;
    const zoom = clamp(
      Math.min(cw / (bw + pad), ch / (bh + pad)),
      MIN_ZOOM,
      1.6
    );
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    this.view.zoom = zoom;
    this.view.panX = cw / 2 - centerX * zoom;
    this.view.panY = ch / 2 - centerY * zoom;
    this.applyTransform();
  }

  /** 选中并聚焦某个节点 */
  focusNode(id: string): void {
    this.select(id);
    const layout = this.layout.nodes.get(id);
    if (!layout) return;
    const rect = this.container.getBoundingClientRect();
    this.view.panX = rect.width / 2 - layout.x * this.view.zoom;
    this.view.panY = rect.height / 2 - layout.y * this.view.zoom;
    this.applyTransform();
  }

  destroy(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
    this.container.classList.remove("mm-canvas");
    this.container.empty();
  }

  // ---------------------------------------------------------------------------
  // 渲染
  // ---------------------------------------------------------------------------

  private render(): void {
    this.nodeEls.clear();
    this.nodeLayerEl.empty();
    while (this.svgEl.firstChild) this.svgEl.removeChild(this.svgEl.firstChild);

    // 1. 渲染节点
    for (const [id, layout] of this.layout.nodes) {
      const el = this.createNodeEl(id, layout);
      this.nodeEls.set(id, el);
    }

    // 2. 测量节点真实尺寸并更新布局
    for (const [id, el] of this.nodeEls) {
      const layout = this.layout.nodes.get(id);
      if (!layout) continue;
      layout.width = Math.max(el.offsetWidth, 20);
      layout.height = Math.max(el.offsetHeight, 20);
    }

    // 3. 渲染连线
    this.renderEdges();

    // 4. 应用缩放/平移，更新选中态
    this.applyTransform();
    this.updateSelection();
  }

  private createNodeEl(id: string, layout: NodeLayout): HTMLElement {
    const node = this.findNode(this.root, id);
    const el = this.nodeLayerEl.createDiv({ cls: "mm-node" });
    if (id === this.root.id) el.classList.add("mm-node-root");
    el.dataset.nodeId = id;
    el.textContent = node ? node.text : "";

    el.style.left = `${layout.x}px`;
    el.style.top = `${layout.y}px`;

    el.addEventListener("pointerdown", (e) => this.onNodePointerDown(e, id));
    el.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.startEdit(id);
    });

    return el;
  }

  private renderEdges(): void {
    // 遍历所有节点，为其子节点画连线
    for (const [id] of this.layout.nodes) {
      const node = this.findNode(this.root, id);
      if (!node) continue;
      const parentLayout = this.layout.nodes.get(id)!;
      for (const child of node.children) {
        const childLayout = this.layout.nodes.get(child.id);
        if (!childLayout) continue;
        this.createEdgePath(parentLayout, childLayout);
      }
    }
  }

  private createEdgePath(
    parent: NodeLayout,
    child: NodeLayout
  ): SVGPathElement {
    // 判断子节点在父节点左侧还是右侧
    const childOnRight = child.x >= parent.x;
    const x1 = childOnRight
      ? parent.x + parent.width / 2
      : parent.x - parent.width / 2;
    const y1 = parent.y;
    const x2 = childOnRight
      ? child.x - child.width / 2
      : child.x + child.width / 2;
    const y2 = child.y;

    const dx = clamp(Math.abs(x2 - x1) * 0.5, 40, 140);
    const cx1 = x1 + dx * (childOnRight ? 1 : -1);
    const cx2 = x2 - dx * (childOnRight ? 1 : -1);

    const d = `M ${x1 + SVG_HALF} ${y1 + SVG_HALF} C ${cx1 + SVG_HALF} ${
      y1 + SVG_HALF
    }, ${cx2 + SVG_HALF} ${y2 + SVG_HALF}, ${x2 + SVG_HALF} ${y2 + SVG_HALF}`;

    const path = this.svgEl.createSvg("path", { cls: "mm-edge" });
    path.setAttribute("d", d);
    return path;
  }

  private applyTransform(): void {
    this.contentEl.style.transform = `translate(${this.view.panX}px, ${this.view.panY}px) scale(${this.view.zoom})`;
  }

  private updateSelection(): void {
    for (const [id, el] of this.nodeEls) {
      el.classList.toggle("mm-node-selected", id === this.selectedId);
    }
  }

  // ---------------------------------------------------------------------------
  // 事件绑定
  // ---------------------------------------------------------------------------

  private bindEvents(): void {
    const onCanvasPointerDown = (e: PointerEvent) => this.onCanvasPointerDown(e);
    const onPointerMove = (e: PointerEvent) => this.onPointerMove(e);
    const onPointerUp = () => this.onPointerUp();
    const onWheel = (e: WheelEvent) => this.onWheel(e);
    const onKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);

    this.container.addEventListener("pointerdown", onCanvasPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    this.container.addEventListener("wheel", onWheel, { passive: false });
    this.container.addEventListener("keydown", onKeyDown);

    this.disposers.push(() => {
      this.container.removeEventListener("pointerdown", onCanvasPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      this.container.removeEventListener("wheel", onWheel);
      this.container.removeEventListener("keydown", onKeyDown);
    });
  }

  private onCanvasPointerDown(e: PointerEvent): void {
    this.container.focus();
    // 点击空白：取消选中，开始平移
    this.select(null);
    this.callbacks.onSelect(null);
    this.drag = {
      type: "pan",
      startScreenX: e.clientX,
      startScreenY: e.clientY,
      startPanX: this.view.panX,
      startPanY: this.view.panY,
      startWorldX: 0,
      startWorldY: 0,
      moved: false,
    };
    this.container.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  private onNodePointerDown(e: PointerEvent, id: string): void {
    e.stopPropagation();
    this.container.focus();

    const layout = this.layout.nodes.get(id);
    if (!layout) return;

    this.select(id);
    this.callbacks.onSelect(id);

    this.drag = {
      type: "node",
      id,
      startScreenX: e.clientX,
      startScreenY: e.clientY,
      startWorldX: layout.x,
      startWorldY: layout.y,
      startPanX: 0,
      startPanY: 0,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.startScreenX;
    const dy = e.clientY - this.drag.startScreenY;

    if (!this.drag.moved && Math.abs(dx) + Math.abs(dy) > 3) {
      this.drag.moved = true;
    }
    if (!this.drag.moved) return;

    if (this.drag.type === "pan") {
      this.view.panX = this.drag.startPanX + dx;
      this.view.panY = this.drag.startPanY + dy;
      this.applyTransform();
    } else if (this.drag.type === "node" && this.drag.id) {
      const layout = this.layout.nodes.get(this.drag.id);
      if (!layout) return;
      layout.x = this.drag.startWorldX + dx / this.view.zoom;
      layout.y = this.drag.startWorldY + dy / this.view.zoom;

      const el = this.nodeEls.get(this.drag.id);
      if (el) {
        el.style.left = `${layout.x}px`;
        el.style.top = `${layout.y}px`;
      }
      this.renderEdges();
    }
  }

  private onPointerUp(): void {
    if (!this.drag) return;
    this.drag = null;
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.container.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
  }

  private onKeyDown(e: KeyboardEvent): void {
    // 编辑状态下不拦截按键
    if (this.editingId) return;

    const id = this.selectedId;
    if (!id) return;

    if (e.key === "Tab") {
      e.preventDefault();
      this.callbacks.onAddChild(id);
    } else if (e.key === "Enter") {
      e.preventDefault();
      this.callbacks.onAddSibling(id);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (id === this.root.id) return; // 根节点不可删除
      e.preventDefault();
      this.callbacks.onDelete(id);
    } else if (e.key === "F2") {
      e.preventDefault();
      this.startEdit(id);
    }
  }

  // ---------------------------------------------------------------------------
  // 编辑
  // ---------------------------------------------------------------------------

  private startEdit(id: string): void {
    if (this.editingId === id) return;
    this.editingId = id;

    const node = this.findNode(this.root, id);
    const el = this.nodeEls.get(id);
    if (!node || !el) {
      this.editingId = null;
      return;
    }

    el.empty();
    el.classList.add("mm-node-editing");

    const input = el.createEl("input", {
      type: "text",
      cls: "mm-node-input",
      value: node.text,
    });
    input.focus();
    input.select();

    let finished = false;
    const commit = () => {
      if (finished) return;
      finished = true;
      this.editingId = null;
      const text = input.value.trim();
      this.callbacks.onRename(id, text.length > 0 ? text : node.text);
    };
    const cancel = () => {
      if (finished) return;
      finished = true;
      this.editingId = null;
      this.render();
    };

    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    });
    input.addEventListener("blur", commit);
  }

  // ---------------------------------------------------------------------------
  // 工具
  // ---------------------------------------------------------------------------

  private findNode(root: MindNode, id: string): MindNode | null {
    if (root.id === id) return root;
    for (const child of root.children) {
      const found = this.findNode(child, id);
      if (found) return found;
    }
    return null;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
