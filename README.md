# Mind Map Canvas

Create and edit mind maps in Obsidian on a zoomable, draggable infinite canvas. Mind maps are stored as nested Markdown lists, so your data stays plain text and works seamlessly with the rest of your notes.

## Features

- **Mind map layout**: Root node centered, with first-level branches expanding symmetrically to the left and right
- **Infinite canvas**: Scroll to zoom, drag to pan, one-click fit-to-view
- **Node editing**: Double-click or `F2` to edit text, `Tab` to add a subtopic, `Enter` to add a sibling topic, `Delete` to remove
- **Free dragging**: Drag any node to an arbitrary position, with connectors following in real time
- **Plain-text persistence**: Saved as nested Markdown lists (`- ` with tab indentation), viewable and editable directly in the editor
- **Two-way sync**: Open any Markdown note and render its nested lists as a mind map

## Installation and build

```bash
npm install
npm run build       # production build, outputs main.js
npm run dev         # development mode, watches for file changes
npm run typecheck   # type check only
```

The build output is `main.js`. Put it together with `manifest.json` and `styles.css` into your vault's plugin folder:

```
<your-vault>/.obsidian/plugins/mindmap-canvas/
├── main.js
├── manifest.json
└── styles.css
```

Then enable **Mind Map Canvas** in Obsidian → Settings → Community plugins.

Requires Obsidian **1.7.2** or later.

## Usage

- Click the ribbon icon, or run **Open mind map** / **New mind map** from the command palette (`Ctrl/Cmd+P`)
- Toolbar buttons, in order: New, Open current note, Add subtopic, Add sibling topic, Delete, Zoom in, Zoom out, Fit view, Reset layout

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Tab` | Add subtopic |
| `Enter` | Add sibling topic |
| `Delete` / `Backspace` | Delete selected node |
| `F2` / double-click | Edit node text |
| Scroll | Zoom |
| Drag empty area | Pan canvas |
| Drag node | Move node |

## Data format

Mind maps are stored as nested Markdown lists, for example:

```markdown
- Central topic
	- Branch one
		- Subtopic A
		- Subtopic B
	- Branch two
```

## Tech stack

- TypeScript, bundled with esbuild
- Obsidian Plugin API (`ItemView`, `registerView`)
- Native DOM + SVG rendering (no third-party runtime dependencies)

## Project structure

```
mindmap-canvas/
├── manifest.json          # plugin metadata
├── package.json
├── tsconfig.json
├── esbuild.config.mjs     # build config
├── versions.json
├── styles.css             # styles
└── src/
    ├── main.ts            # plugin entry point
    ├── view.ts            # mind map view (ItemView)
    ├── renderer.ts        # canvas rendering and interaction
    ├── layout.ts          # tree layout algorithm
    ├── model.ts           # Markdown parsing / serialization
    └── types.ts           # type definitions
```

## 中文说明

在 Obsidian 中创建、编辑思维导图的画布插件。数据以 Markdown 嵌套列表（`- ` + tab 缩进）保存，可在编辑器中直接查看和修改，并提供滚轮缩放、拖拽平移、一键自适应等无限画布能力。

- 用法：点击左侧功能区图标，或执行命令面板中的「打开思维导图」/「新建思维导图」
- 快捷键：`Tab` 添加子主题，`Enter` 添加同级主题，`Delete` 删除节点，`F2`/双击 编辑文字
- 构建：`npm install` 后执行 `npm run build`，将产物放入 `<库>/.obsidian/plugins/mindmap-canvas/`
- 要求 Obsidian 1.7.2 及以上

## License

MIT
