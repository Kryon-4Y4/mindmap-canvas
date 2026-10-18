// 插件入口：注册视图、命令与功能区图标
import { Plugin, TFile, Notice } from "obsidian";
import { MindMapView, VIEW_TYPE_MINDMAP } from "./view";
import { createDefaultTree, serializeMarkdown } from "./model";

export default class MindMapCanvasPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(VIEW_TYPE_MINDMAP, (leaf) => new MindMapView(leaf));

    this.addRibbonIcon("network", "打开思维导图画布", () => {
      void this.openMindMap();
    });

    this.addCommand({
      id: "open-mindmap",
      name: "打开思维导图",
      callback: () => void this.openMindMap(),
    });

    this.addCommand({
      id: "new-mindmap",
      name: "新建思维导图",
      callback: () => void this.newMindMap(),
    });
  }

  /** 打开当前活动笔记对应的思维导图 */
  private async openMindMap(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("请先打开一个 Markdown 文件，或使用「新建思维导图」命令");
      return;
    }
    await this.activateView(file);
  }

  /** 新建一份思维导图文件并打开画布 */
  private async newMindMap(): Promise<void> {
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
      await this.activateView(file);
      new Notice(`已创建思维导图：${name}`);
    } catch (e) {
      new Notice("新建思维导图失败：" + String(e));
    }
  }

  /** 激活（或创建）思维导图视图，并加载指定文件 */
  private async activateView(file: TFile): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_MINDMAP)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      leaf = rightLeaf ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_MINDMAP, active: true });
    }

    await workspace.revealLeaf(leaf);
    const view = leaf.view as MindMapView;
    await view.loadFile(file);
  }
}
