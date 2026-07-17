# YOLO Game UI Labeler

> 一个为游戏 UI 标注场景设计的桌面标注工具——开箱即用，标注结果直接用于 YOLO 模型训练。

**为什么用这个？** 通用标注工具（LabelImg、CVAT）功能繁多，操作流程与游戏 UI 标注场景不匹配。这个工具只做一件事：让你高效地在游戏截图上画框，导出标准 YOLO TXT 格式。

---

## 特性

- 🖥️ **桌面原生** — 基于 Tauri，双击安装包就能用，不需要装 Python、不用开终端
- 🎮 **游戏 UI 专属** — 四种形状（矩形/正方形/椭圆/圆形）+ 十字准星辅助线，覆盖按钮、图标、血条等常见 UI 元素的标注
- 🔑 **全键盘操作** — 从切图、选工具、换类别到审核，全程不用碰鼠标
- 💾 **即时自动保存** — 每次画完框立刻写入 YOLO TXT，随时可用于训练
- 🔄 **支持断点续标** — 关了再开自动回到上次位置，标注进度不丢失
- 📦 **轻量安装包** — 约 40 MB，内嵌完整 Python 运行时
- 🏷️ **形状编码命名** — 类别名自带形状信息（如 `Btn_Circle`），YOLO 推理后可直接从 class name 获取形状和点击坐标

---

## 安装

从 [Releases](https://github.com/SadRenger/yolo-game-ui-labeler/releases) 下载 `YOLO_Game_UI_Labeler_1.0.0_x64-setup.msi`，双击安装。

> 系统要求：Windows 10 1803+ / Windows 11 或 macOS 11+

---

## 快速开始

### 1. 准备类别文件

在任意位置创建一个 `classes.json`：

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

- `id` — 从 0 开始的整数，对应 YOLO 的 class_id
- `name` — 建议用 `{类别}_{形状}` 命名，训练后可直接从名称中提取形状信息
- `color` — 画布上标注框的显示颜色

### 2. 创建项目

启动应用 → 点击 **"+ 新建项目"** → 填写名称、选择图片文件夹、选择 `classes.json`。

### 3. 开始标注

| 操作 | 方式 |
|------|------|
| 选形状 | 按 `1` `2` `3` `4` 或点击底部工具栏 |
| 画框 | 在图片上拖拽鼠标 |
| 换类别 | 按 `5`-`9` 或顶部下拉框 |
| 切图片 | 按 `A` / `D` 或点击左侧缩略图 |

画完的标注自动保存在 `labels/` 目录，文件与图片同名。

---

## 使用指南

### 类别命名约定——形状编码

这是本工具的核心设计：**将形状信息编码在类别名中**，YOLO 模型训练和推理时可以自然携带。

```
类别名: Btn_Circle
         ↑     ↑
       类别   形状

模型返回: class="Btn_Circle", bbox=(0.52, 0.31, 0.09, 0.09)
脚本解析:
  - 形状: "Circle" — 从 class name 提取
  - 点击坐标: (0.52, 0.31) — bbox 中心点
```

推荐命名模式：`{类别}_{形状}`，如 `Btn_Rect`、`Icon_Ellipse`、`HP_Bar`。

### 标注操作

**工具栏（底部）**：矩形 `1` / 正方形 `2` / 椭圆 `3` / 圆形 `4` / 选择移动 `S`

**绘制**：选工具后在图片上拖拽。按住 `Shift` 可临时在正方形↔矩形、圆形↔椭圆间切换。

**选中与编辑**：按 `S` 进入选择模式 → 点击标注框选中 → 拖拽移动 / `Delete` 删除。重叠框重复点击可循环切换。

**属性面板**（右侧，选中框时出现）：查看/修改类别、查看位置和尺寸、删除按钮。

### 画布操作

| 操作 | 方式 |
|------|------|
| 缩放 | `Ctrl+滚轮`（以鼠标为中心） |
| 平移 | 右键拖拽 |
| 100% 原始大小 | 按 `0` |
| 自适应窗口 | 双击空白区域 |
| 十字准星 | 按 `H` 切换（默认开） |
| 缩放范围 | 10% ~ 500% |

### 审核标记

标注确认无误后，按 `R` 键标记为"已审核"。侧边栏用颜色区分：
- 🟢 已审核 — 标注完成且已确认
- 🟡 已标注 — 有标注框，待审核
- ⚪ 未标注 — 尚无标注

顶部筛选按钮可快速只显示"未标注"或"已审核"的图片。

### 快捷键速查

| 键 | 功能 | | 键 | 功能 |
|----|------|---|----|------|
| `1` `2` `3` `4` | 矩形 / 正方形 / 椭圆 / 圆形 | `S` | 选择/移动模式 |
| `5`-`9` | 快速切换类别 1-5 | `Delete` | 删除选中框 |
| `A` `←` / `D` `→` | 上一张 / 下一张 | `R` | 审核标记开关 |
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 | `H` | 十字准星开关 |
| `Ctrl+S` | 手动保存 | `0` | 缩放 100% |
| `Shift`（绘制中） | 临时切换正方形↔矩形 | `Ctrl+滚轮` | 缩放 |
| 右键拖拽 | 平移画布 | 双击空白 | 自适应窗口 |

---

## 输出格式

标注文件以 YOLO TXT 格式保存，与图片同名：

```
项目目录/
├── images/
│   ├── screenshot_001.png
│   ├── screenshot_002.png
│   └── ...
├── labels/
│   ├── screenshot_001.txt   ← 训练用
│   ├── screenshot_002.txt
│   └── ...
└── classes.json
```

每行一个标注：`class_id x_center y_center width height`

```
0 0.523438 0.312500 0.089063 0.045185
2 0.122917 0.567593 0.034375 0.034537
```

坐标全部归一化到 0~1，保留 6 位小数。`labels/` 文件夹可直接用于 YOLO 训练。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | Tauri 2.x (Rust) |
| 后端 | Django 6.x + Django REST Framework |
| 前端 | 原生 HTML5 + CSS3 + JavaScript（零框架） |
| 图形渲染 | HTML5 Canvas API |
| 图片处理 | Pillow + OpenCV-Python |
| 打包 | Tauri Bundler → `.msi` |

### 项目结构

```
├── src-tauri/          # Tauri Rust 源码
├── manage.py           # Django 入口
├── labeler/            # Django 应用
├── static/             # 前端静态资源
│   ├── css/app.css
│   └── js/
│       ├── app.js      # 主入口
│       ├── canvas.js   # Canvas 渲染引擎
│       ├── annotation.js # 标注逻辑
│       ├── sidebar.js  # 图片列表
│       ├── toolbar.js  # 底部工具栏
│       └── projects.js # 项目管理页
├── templates/          # HTML 模板
├── projects/           # 用户项目数据（运行时）
├── runtime/            # 嵌入式 Python 运行时
└── docs/               # 设计文档
```

---

## 开发

```bash
# 克隆仓库
git clone https://github.com/SadRenger/yolo-game-ui-labeler.git
cd yolo-game-ui-labeler

# 安装 Python 依赖
pip install -r requirements.txt

# 启动 Django 后端
python manage.py runserver

# 启动 Tauri 桌面壳（另一个终端）
cd src-tauri
cargo tauri dev
```

---

## 路线图

当前版本 **v1.0** — 标注核心功能完整可用。

**v2.0 候选功能：**
- 多边形/折线标注（YOLO OBB 格式）
- 标注间复制粘贴（跨图片）
- 图片预处理（亮度/对比度/伽马）
- 多格式导出（COCO JSON、Pascal VOC XML）
- 标注验证规则

---

## 协议

MIT — 随便用、随便改、随便商用。

---

## 系列项目

- [YOLO Model Trainer](https://github.com/SadRenger/yolo-model-trainer) — 图形化 YOLO 模型训练工具。标注完数据？用这个一键训练。
