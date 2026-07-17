<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)">
    <img alt="YOLO Game UI Labeler" width="520" src="docs/logo.svg" onerror="this.style.display='none'">
  </picture>
</p>

<p align="center">
  <strong>为游戏 UI 标注而生 — 画完框直接训练，没有多余的步骤。</strong>
  <br>
  <em>A desktop labeling tool built for game UI — draw boxes, export YOLO TXT, no extra steps.</em>
</p>

<p align="center">
  <a href="https://github.com/SadRenger/yolo-game-ui-labeler/releases"><img src="https://img.shields.io/github/v/release/SadRenger/yolo-game-ui-labeler?color=%234fc3f7&label=release" alt="Release"></a>
  <a href="https://github.com/SadRenger/yolo-game-ui-labeler/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-%2358a6ff" alt="License: MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-Windows%2010%2F11%20%7C%20macOS%2011%2B-%234fc3f7" alt="Platform: Windows & macOS"></a>
  <a href="#"><img src="https://img.shields.io/badge/desktop-Tauri%202.x-%23bc8cff" alt="Tauri 2.x"></a>
  <a href="#"><img src="https://img.shields.io/badge/backend-Django%206.x-%2358a6ff" alt="Django 6.x"></a>
</p>

<br>

---

## 🤔 Why? · 为什么用这个？

LabelImg 功能太多、CVAT 太重、MakeSense 要开浏览器……通用标注工具没有为**游戏 UI 标注**这一个场景做优化。

**YOLO Game UI Labeler** 只做一件事：让你在游戏截图上快速画框。矩形按钮、圆形图标、椭圆血条——四种形状一键切换。画完自动保存为标准 YOLO TXT 格式，打开 [YOLO Trainer](https://github.com/SadRenger/yolo-model-trainer) 就能训练。

> *LabelImg is bloated, CVAT is heavy, MakeSense needs a browser. Generic tools aren't optimized for game UI labeling. This tool does one thing: draw bounding boxes on game screenshots — fast. Rectangles, circles, ellipses, squares — four shape tools at your fingertips. Auto-saves in YOLO TXT format, ready to train with YOLO Trainer.*

---

## ✨ Features · 核心特性

<table>
<tr>
  <td width="50%">
    <h4>🎮 四种标注形状</h4>
    <p>矩形 / 正方形 / 椭圆 / 圆形 — 覆盖按钮、图标、血条、技能冷却等所有 UI 元素形态。</p>
    <p><em>Rect · Square · Ellipse · Circle — covers buttons, icons, HP bars, skill cooldowns, and more.</em></p>
  </td>
  <td width="50%">
    <h4>⌨️ 全键盘操作</h4>
    <p>切图、选工具、换类别、审核标记 — 全程不用手离开键盘，标注效率翻倍。</p>
    <p><em>Switch images, pick tools, change classes, mark as reviewed — all from the keyboard. Hands never leave the keys.</em></p>
  </td>
</tr>
<tr>
  <td>
    <h4>💾 即时自动保存</h4>
    <p>画完框的瞬间就写入 YOLO TXT 文件。断电、崩溃、手滑关闭 — 标注数据不丢失。</p>
    <p><em>Bounding boxes are written to disk the moment you draw them. Crash, power loss, accidental close — your work is safe.</em></p>
  </td>
  <td>
    <h4>🔄 断点续标</h4>
    <p>关闭应用再打开，自动回到上次标注的位置。记录审核状态，一眼看出哪些还没标完。</p>
    <p><em>Close and reopen — picks up right where you left off. Review status is preserved across sessions.</em></p>
  </td>
</tr>
<tr>
  <td>
    <h4>🏷️ 形状编码命名</h4>
    <p>类别名自带形状信息（如 <code>Btn_Circle</code>）。YOLO 推理后可直接从 class name 提取形状类型和点击坐标。</p>
    <p><em>Shape info encoded in class names. After inference, extract shape type and click coordinates directly from the class name.</em></p>
  </td>
  <td>
    <h4>🔍 十字准星辅助</h4>
    <p>可开关的十字准星线，精确对齐 UI 元素的中心和边缘。标注精度有保障。</p>
    <p><em>Toggleable crosshair cursor for pixel-perfect alignment with UI element centers and edges.</em></p>
  </td>
</tr>
<tr>
  <td>
    <h4>✅ 审核工作流</h4>
    <p>标注 → 审核 → 完成。侧边栏颜色标记（🟢已审/🟡已标/⚪未标），筛选快速定位遗漏。</p>
    <p><em>Label → Review → Done. Color-coded sidebar with one-click filters to find what's missing.</em></p>
  </td>
  <td>
    <h4>📦 轻量打包</h4>
    <p>安装包约 40 MB，内嵌完整 Python 运行时。不需要装 Python、Django、任何依赖。</p>
    <p><em>~40 MB installer with embedded Python runtime. No Python, Django, or dependency setup required.</em></p>
  </td>
</tr>
</table>

---

## 📸 Screenshots · 界面预览

> *Screenshots coming soon.*

<p align="center">
  <table>
    <tr>
      <td align="center"><b>🏠 项目管理</b><br><em>Project List</em></td>
      <td align="center"><b>✏️ 标注工作区</b><br><em>Annotation Workspace</em></td>
    </tr>
  </table>
</p>

---

## 🚀 Quick Start · 快速开始

### 📥 安装 / Installation

从 [Releases](https://github.com/SadRenger/yolo-game-ui-labeler/releases) 下载安装包，双击安装。

> **系统要求 / Requirements：** Windows 10 (1803+) / Windows 11 · macOS 11+

| | 最低 / Minimum | 推荐 / Recommended |
|---|---|---|
| 内存 / RAM | 4 GB | 8 GB+ |
| 磁盘 / Disk | 200 MB 可用 | 500 MB+ 可用 |

### 📝 3 步开始标注 / Start Labeling in 3 Steps

**第 1 步：** 准备一个 `classes.json` 文件

```json
{
  "classes": [
    {"id": 0, "name": "Btn_Circle",   "color": "#FF4444"},
    {"id": 1, "name": "Btn_Rect",     "color": "#FF6666"},
    {"id": 2, "name": "Icon_Circle",  "color": "#44BB44"},
    {"id": 3, "name": "Icon_Ellipse", "color": "#66DD66"},
    {"id": 4, "name": "HP_Bar",       "color": "#4444FF"},
    {"id": 5, "name": "Skill_CD",     "color": "#FFAA00"}
  ]
}
```

> **命名建议：** 用 `{类别}_{形状}` 格式。训练后可直接从 YOLO 输出的 class name 中提取形状类型。*Use `{Category}_{Shape}` naming — extract shape info from class names after inference.*

**第 2 步：** 启动应用 → 点击 **"+ 新建项目"** → 填写名称、选择图片文件夹、选择 `classes.json`。

**第 3 步：** 开始标注！

| 操作 / Action | 按键 / Key |
|---|---|
| 选形状 / Pick shape | `1` `2` `3` `4` |
| 画框 / Draw box | 在图上拖拽 / Drag on image |
| 换类别 / Switch class | `5`–`9` |
| 切图片 / Prev/next image | `A` / `D` |
| 审核标记 / Toggle reviewed | `R` |

画完的标注自动保存在 `labels/` 目录 — 直接拿去训练。

---

## ⌨️ Keyboard Shortcuts · 快捷键

| 键 / Key | 功能 / Action | | 键 / Key | 功能 / Action |
|---|---|---|---|---|
| `1` `2` `3` `4` | 矩形 / 正方形 / 椭圆 / 圆形 | `S` | 选择/移动模式 |
| `5`–`9` | 快速切换类别 1–5 | `Delete` | 删除选中框 |
| `A` `←` / `D` `→` | 上一张 / 下一张 | `R` | 审核标记开关 |
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 | `H` | 十字准星开关 |
| `Ctrl+S` | 手动保存 | `0` | 缩放至 100% |
| `Shift`（拖拽中） | 矩形↔正方形 临时切换 | `Ctrl+滚轮` | 缩放画布 |
| 右键拖拽 | 平移画布 | 双击空白区域 | 自适应窗口 |

---

## 📂 Output Format · 输出格式

```
你的项目目录/
├── images/
│   ├── screenshot_001.png
│   ├── screenshot_002.png
│   └── ...
├── labels/                  ← 直接用于 YOLO 训练
│   ├── screenshot_001.txt   ← 与图片同名
│   ├── screenshot_002.txt
│   └── ...
└── classes.json
```

每行一个标注框（YOLO 标准格式，坐标归一化到 0~1）：

```
class_id x_center y_center width height
```

```
0 0.523438 0.312500 0.089063 0.045185
2 0.122917 0.567593 0.034375 0.034537
```

---

## 🏗️ Architecture · 系统架构

```
┌──────────────────────────────────────────┐
│        Tauri 前端 / Frontend              │
│  HTML5 + CSS3 + Vanilla JS               │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│  │ Canvas   │ │ Sidebar  │ │ Toolbar │  │
│  │ 标注画布  │ │ 图片列表  │ │ 工具栏   │  │
│  └────┬─────┘ └────┬─────┘ └────┬────┘  │
│       └────────────┴────────────┘        │
│            REST API (fetch)              │
└────────────────┬─────────────────────────┘
                 │  HTTP localhost
┌────────────────┴─────────────────────────┐
│        Django 后端 / Backend              │
│  Django 6.x + Django REST Framework      │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│  │ Images   │ │ Labels   │ │Projects │  │
│  │ 图片管理  │ │ 标注读写  │ │ 项目管理 │  │
│  └──────────┘ └──────────┘ └─────────┘  │
│         Pillow + OpenCV (图片处理)       │
└──────────────────────────────────────────┘
```

---

## 🧰 Tech Stack · 技术栈

| Layer · 层 | Tech · 技术 | Notes · 说明 |
|---|---|---|
| 桌面壳 / Shell | **Tauri 2.x** (Rust) | WebView2 / WKWebView 渲染 |
| 前端 / Frontend | **HTML5 + CSS3 + Vanilla JS** | Canvas API 图形渲染，零框架 |
| 后端 / Backend | **Django 6.x + DRF** | REST API，本地 localhost |
| 图片处理 / Image | **Pillow + OpenCV** | 图片读取、尺寸获取 |
| 运行时 / Runtime | **嵌入式 Python** | 打包进安装包，无需用户安装 |
| 打包 / Packaging | **Tauri Bundler → .msi** | 约 40 MB |

---

## 📂 Project Structure · 项目结构

```
yolo-game-ui-labeler/
├── src-tauri/           # Tauri Rust 壳 · Tauri shell
│   └── src/main.rs
├── labeler/             # Django 应用 · Django app
│   ├── views.py         # API 视图 · API views
│   ├── models.py        # 数据模型 · data models
│   └── urls.py          # 路由 · URL routing
├── manage.py            # Django 入口 · entry point
├── static/              # 前端 · frontend
│   ├── css/app.css
│   └── js/
│       ├── app.js       # 主入口 · main entry
│       ├── canvas.js    # Canvas 渲染引擎 · rendering engine
│       ├── annotation.js # 标注逻辑 · annotation logic
│       ├── sidebar.js   # 图片列表 · image list
│       ├── toolbar.js   # 底部工具栏 · bottom toolbar
│       └── projects.js  # 项目管理 · project management
├── templates/           # HTML 模板 · HTML templates
├── docs/                # 设计文档 · design docs
├── projects/            # 用户项目数据（运行时忽略）· user data (gitignored)
├── runtime/             # 嵌入式 Python（构建产物）· embedded Python (build artifact)
├── launcher.bat         # Windows 启动脚本 · Windows launcher
├── requirements.txt     # Python 依赖 · Python deps
├── README.md            # 本文件 · you are here
└── LICENSE              # MIT
```

---

## 🔧 Development · 开发

```bash
# 1. 克隆仓库 / Clone
git clone git@github.com:SadRenger/yolo-game-ui-labeler.git
cd yolo-game-ui-labeler

# 2. 安装 Python 依赖 / Install Python deps
pip install -r requirements.txt

# 3. 启动 Django 后端 / Start Django backend
python manage.py runserver

# 4. 启动 Tauri 桌面壳（另一个终端）/ Start Tauri shell (separate terminal)
cd src-tauri
cargo tauri dev
```

---

## 🎯 Roadmap · 路线图

| 版本 / Version | 内容 / Content |
|---|---|
| **v1.0** ✅ | 标注核心功能 — 4 种形状、全键盘操作、自动保存、审核标记、断点续标 |
| v2.0 🔜 | 多边形标注（OBB 格式）、跨图片复制粘贴、图片预处理、COCO/VOC 导出、标注验证规则 |

---

## 🤝 Contributing · 参与贡献

欢迎提 Issue 和 PR！详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

*Issues and PRs are welcome!*

---

## 🔗 Related · 系列项目

| 项目 / Project | 说明 / Description |
|---|---|
| **YOLO Game UI Labeler** ← 你在这里 · *you are here* | 🏷️ 标注工具 — 标完数据？一键训练 |
| [**YOLO Trainer**](https://github.com/SadRenger/yolo-model-trainer) | 🚀 训练工具 — 图形化 YOLO 训练，标注完直接训练 |

---

## 📄 License · 协议

MIT © YOLO Game UI Labeler Contributors — 随便用、随便改、随便商用。*Use, modify, and distribute freely.*

---

<p align="center">
  <br>
  <strong>⭐ 如果这个项目对你有用，给个 Star 支持一下！</strong>
  <br>
  <em>If you find this useful, a star would be appreciated!</em>
  <br><br>
  <a href="https://github.com/SadRenger/yolo-game-ui-labeler/stargazers"><img src="https://img.shields.io/github/stars/SadRenger/yolo-game-ui-labeler?style=social" alt="Stars"></a>
</p>
