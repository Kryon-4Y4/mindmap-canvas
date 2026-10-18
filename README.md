# Mind Map Canvas — Obsidian 思维导图画布插件

在 Obsidian 中创建、编辑思维导图。提供可无限缩放、可自由拖拽的画布，数据以 Markdown 嵌套列表形式存储，与笔记生态无缝衔接。

## 功能特性

- **思维导图画布**：根节点居中、一级分支左右对称展开的树形布局
- **无限画布**：滚轮缩放、拖拽平移、一键自适应视图
- **节点编辑**：双击 / F2 编辑文字，Tab 添加子主题，Enter 添加同级主题，Delete 删除
- **自由拖拽**：节点可拖拽到任意位置，连线实时跟随
- **数据持久化**：以 Markdown 嵌套列表（`- ` + tab 缩进）保存，可直接在编辑器查看/修改结构
- **双向联动**：打开任意 Markdown 笔记，将其嵌套列表渲染为思维导图

## 安装与构建

```bash
npm install
npm run build       # 生产构建，生成 main.js
npm run dev         # 开发模式，监听文件变化
npm run typecheck   # 仅类型检查
```

构建产物为 `main.js`，与 `manifest.json`、`styles.css` 一起放入测试库的插件目录：

```
<你的库>/.obsidian/plugins/mindmap-canvas/
├── main.js
├── manifest.json
└── styles.css
```

然后在 Obsidian 设置 → 第三方插件中启用「Mind Map Canvas」。

## 使用方式

- 点击左侧功能区图标，或执行命令面板（Ctrl/Cmd+P）中的「打开思维导图」/「新建思维导图」
- 工具栏按钮依次为：新建、打开当前笔记、添加子主题、添加同级主题、删除、放大、缩小、自适应、重置布局

## 快捷键

| 快捷键 | 操作 |
| --- | --- |
| `Tab` | 添加子主题 |
| `Enter` | 添加同级主题 |
| `Delete` / `Backspace` | 删除选中节点 |
| `F2` / 双击 | 编辑节点文字 |
| 滚轮 | 缩放 |
| 拖拽空白 | 平移画布 |
| 拖拽节点 | 移动节点 |

## 数据结构

思维导图以 Markdown 嵌套列表存储，例如：

```markdown
- 中心主题
	- 分支一
		- 子主题 A
		- 子主题 B
	- 分支二
```

## 技术栈

- TypeScript + esbuild 打包
- Obsidian Plugin API（`ItemView`、`registerView`）
- 原生 DOM + SVG 渲染（无第三方运行时依赖）

## 项目结构

```
mindmap-canvas/
├── manifest.json          # 插件元数据
├── package.json
├── tsconfig.json
├── esbuild.config.mjs     # 构建配置
├── versions.json
├── styles.css             # 样式
└── src/
    ├── main.ts            # 插件入口
    ├── view.ts            # 思维导图视图（ItemView）
    ├── renderer.ts        # 画布渲染与交互
    ├── layout.ts          # 树形布局算法
    ├── model.ts           # Markdown 解析/序列化
    └── types.ts           # 类型定义
```

## License

MIT
