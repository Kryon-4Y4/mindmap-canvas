// 思维导图视图：ItemView，负责工具栏、文件读写与数据变更
import { App, ItemView, Modal, TFile, Notice, setIcon } from "obsidian";
import { MindMapRenderer } from "./renderer";
import {
  MindNode,
} from "./types";
import {
  parseMarkdown,
  serializeMarkdown,
  createDefaultTree,
  findNode,
  findParent,
  reindex,
} from "./model";

export const VIEW_TYPE_MINDMAP = "mindmap-canvas-view";

export class MindMapView extends ItemView {
  private renderer: MindMapRenderer;
  private file: TFile | null = null;
  private saveTimer: number | null = null;
  private statusEl: HTMLElement;

  getViewType(): string {
    return VIEW_TYPE_MINDMAP;
  }

  getDisplayText(): string {
    return this.file ? this.file.basename : "思维导图";
  }

  getIcon(): string {
    return "network";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.classList.add("mm-view");

    this.buildToolbar(container);

    const canvasHost = container.createDiv({ cls: "mm-canvas-host" });

    this.renderer = new MindMapRenderer(canvasHost, {
      onRename: (id, text) => this.handleRename(id, text),
      onAddChild: (id) => this.handleAddChild(id),
      onAddSibling: (id) => this.handleAddSibling(id),
      onDelete: (id) => this.handleDelete(id),
      onSelect: () => this.updateStatus(),
    });

    // 初始默认树
    this.renderer.setRoot(createDefaultTree());
    this.renderer.fitView();
    this.updateStatus();
  }

  async onClose(): Promise<void> {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.renderer?.destroy();
  }

  // ---------------------------------------------------------------------------
  // 文件加载与保存
  // ---------------------------------------------------------------------------

  async loadFile(file: TFile): Promise<void> {
    this.file = file;
    let root: MindNode;
    try {
      const content = await this.app.vault.read(file);
      root = parseMarkdown(content);
      if (root.children.length === 0 && root.text.trim() === "") {
        root = createDefaultTree();
      }
    } catch {
      root = createDefaultTree();
    }
    this.renderer.setRoot(root);
    this.renderer.fitView();
    this.updateStatus();
  }

  private scheduleSave(): void {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.save();
    }, 400);
  }

  private async save(): Promise<void> {
    if (!this.file) return;
    const content = serializeMarkdown(this.renderer.getRoot());
    try {
      await this.app.vault.modify(this.file, content);
    } catch (e) {
      new Notice("保存思维导图失败：" + String(e));
    }
  }

  // ---------------------------------------------------------------------------
  // 数据变更处理
  // ---------------------------------------------------------------------------

  private mutate(fn: (root: MindNode) => void): void {
    const root = this.renderer.getRoot();
    fn(root);
    reindex(root, "0");
    this.renderer.setRoot(root);
    this.updateStatus();
    this.scheduleSave();
  }

  private handleRename(id: string, text: string): void {
    this.mutate((root) => {
      const node = findNode(root, id);
      if (node) node.text = text;
    });
  }

  private handleAddChild(id: string): void {
    this.mutate((root) => {
      const node = findNode(root, id);
      if (!node) return;
      const child: MindNode = { id: "", text: "新主题", children: [] };
      node.children.push(child);
    });
    // 聚焦到新节点，方便继续输入
    const root = this.renderer.getRoot();
    const node = findNode(root, id);
    if (node && node.children.length > 0) {
      const child = node.children[node.children.length - 1];
      this.renderer.focusNode(child.id);
    }
  }

  private handleAddSibling(id: string): void {
    const root = this.renderer.getRoot();
    if (id === root.id) {
      // 根节点无法添加同级，改为添加子节点
      this.handleAddChild(id);
      return;
    }
    const parentInfo = findParent(root, id);
    if (!parentInfo) return;
    this.mutate((r) => {
      const info = findParent(r, id);
      if (!info) return;
      const sibling: MindNode = { id: "", text: "新主题", children: [] };
      info.parent.children.splice(info.index + 1, 0, sibling);
    });
    const newRoot = this.renderer.getRoot();
    const info = findParent(newRoot, id);
    if (info && info.parent.children[info.index + 1]) {
      this.renderer.focusNode(info.parent.children[info.index + 1].id);
    }
  }

  private handleDelete(id: string): void {
    const root = this.renderer.getRoot();
    if (id === root.id) return;
    const parentInfo = findParent(root, id);
    if (!parentInfo) return;
    const node = findNode(root, id);
    // countNodes 包含节点自身，子主题数量需减 1
    const childCount = node ? countNodes(node) - 1 : 0;
    const confirmMsg =
      childCount > 0
        ? `删除「${node?.text ?? ""}」及其 ${childCount} 个子主题？`
        : `删除「${node?.text ?? ""}」？`;

    new ConfirmModal(this.app, confirmMsg, (confirmed) => {
      if (!confirmed) return;
      this.mutate((r) => {
        const info = findParent(r, id);
        if (!info) return;
        info.parent.children.splice(info.index, 1);
      });
      this.renderer.select(null);
    }).open();
  }

  // ---------------------------------------------------------------------------
  // 工具栏与状态栏
  // ---------------------------------------------------------------------------

  private buildToolbar(container: HTMLElement): void {
    const toolbar = container.createDiv({ cls: "mm-toolbar" });

    this.addButton(toolbar, "file-plus", "新建思维导图", () => void this.newFile());
    this.addButton(toolbar, "folder-open", "打开当前笔记为思维导图", () => void this.openActiveFile());
    this.addDivider(toolbar);
    this.addButton(toolbar, "corner-down-right", "添加子主题 (Tab)", () => {
      const id = this.renderer?.getSelectedId();
      if (id) this.handleAddChild(id);
      else new Notice("请先选中一个节点");
    });
    this.addButton(toolbar, "plus", "添加同级主题 (Enter)", () => {
      const id = this.renderer?.getSelectedId();
      if (id) this.handleAddSibling(id);
      else new Notice("请先选中一个节点");
    });
    this.addButton(toolbar, "trash", "删除节点 (Delete)", () => {
      const id = this.renderer?.getSelectedId();
      if (id) this.handleDelete(id);
      else new Notice("请先选中一个节点");
    });
    this.addDivider(toolbar);
    this.addButton(toolbar, "zoom-in", "放大", () => this.renderer?.zoomIn());
    this.addButton(toolbar, "zoom-out", "缩小", () => this.renderer?.zoomOut());
    this.addButton(toolbar, "maximize", "自适应视图", () => this.renderer?.fitView());
    this.addButton(toolbar, "refresh-cw", "重置布局", () => {
      const root = this.renderer?.getRoot();
      if (root) this.renderer.setRoot(root);
    });

    toolbar.createDiv({ cls: "mm-toolbar-spacer" });
    this.statusEl = toolbar.createDiv({ cls: "mm-status" });
  }

  private addButton(
    parent: HTMLElement,
    icon: string,
    title: string,
    onClick: () => void
  ): HTMLElement {
    const btn = parent.createEl("button", { cls: "mm-btn", attr: { title } });
    setIcon(btn, icon);
    btn.addEventListener("click", onClick);
    return btn;
  }

  private addDivider(parent: HTMLElement): void {
    parent.createDiv({ cls: "mm-divider" });
  }

  private updateStatus(): void {
    if (!this.statusEl) return;
    const root = this.renderer?.getRoot();
    const total = root ? countNodes(root) : 0;
    const sel = this.renderer?.getSelectedId();
    this.statusEl.setText(
      `${this.file ? this.file.basename : "未关联文件"} · ${total} 个节点` +
        (sel ? ` · 已选中` : "")
    );
  }

  private async newFile(): Promise<void> {
    const base = "思维导图";
    let name = base;
    let i = 1;
    while (this.app.vault.getAbstractFileByPath(`${name}.md`)) {
      name = `${base} ${i}`;
      i++;
    }
    try {
      const file = await this.app.vault.create(
        `${name}.md`,
        serializeMarkdown(createDefaultTree())
      );
      await this.loadFile(file);
      new Notice(`已创建思维导图：${name}`);
    } catch (e) {
      new Notice("新建失败：" + String(e));
    }
  }

  private async openActiveFile(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("当前没有打开的 Markdown 文件");
      return;
    }
    await this.loadFile(file);
  }
}

/** 使用 Obsidian 原生 Modal 风格的确认框，替代 window.confirm */
class ConfirmModal extends Modal {
  constructor(
    app: App,
    private message: string,
    private onResult: (confirmed: boolean) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.createEl("p", { text: this.message });
    const row = this.contentEl.createDiv({ cls: "mm-confirm-row" });

    const confirmBtn = row.createEl("button", {
      text: "删除",
      cls: "mod-warning",
    });
    confirmBtn.addEventListener("click", () => this.finish(true));

    const cancelBtn = row.createEl("button", { text: "取消" });
    cancelBtn.addEventListener("click", () => this.finish(false));
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private finish(result: boolean): void {
    this.onResult(result);
    this.close();
  }
}

function countNodes(node: MindNode): number {
  let n = 1;
  for (const child of node.children) n += countNodes(child);
  return n;
}
