# YOLO Game UI Labeler

游戏 UI 标注桌面工具 — 支持矩形、正方形、椭圆、圆形标注，导出 YOLO TXT 格式直接用于模型训练。

## 安装与启动

双击桌面快捷方式 **"YOLO Game UI Labeler"** 启动应用。

首次启动会自动初始化 Django 后端（稍等几秒），完成后显示项目选择页面。

> 如果桌面没有快捷方式，可运行 `src-tauri/target/debug/yolo-game-ui-labeler.exe`

---

## 快速开始

### 1. 准备类别配置文件

创建一个 `classes.json`，格式如下：

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

| 字段 | 说明 |
|------|------|
| `id` | 类别编号，从 0 开始，对应 YOLO class_id |
| `name` | 类别名称，**建议编码形状信息**（如 `Btn_Circle`） |
| `color` | 标注框显示颜色 |

### 2. 新建项目

点击 **"+ 新建项目"**，填写：

- **项目名称** — 字母/数字/下划线/中文
- **图片目录** — 点击"浏览"选择图片文件夹（支持 .jpg/.jpeg/.png）
- **标注存放目录**（可选）— 自定义 YOLO TXT 输出位置，默认保存在项目内
- **类别配置** — 点击"浏览"选择准备好的 `classes.json`

点击"创建项目"进入标注界面。

### 3. 标注操作

#### 基本流程

1. 在顶部下拉框**选择类别**
2. 在底部工具栏**选择形状工具**（或按快捷键 `1`-`4`）
3. 在 Canvas 上**拖拽绘制**标注框
4. 每次绘制自动保存到 `labels/` 目录

#### 四种形状

| 工具 | 快捷键 | 说明 |
|------|--------|------|
| ▬ 矩形 | `1` | 自由拖拽画矩形 |
| ◻ 正方形 | `2` | 锁定 1:1 比例 |
| ◯ 椭圆 | `3` | 内切椭圆 |
| ● 圆形 | `4` | 锁定 1:1 内切正圆 |

> 拖拽时按住 **Shift** 可临时切换：正方形↔矩形、圆形↔椭圆。

#### 编辑与导航

| 操作 | 快捷键 |
|------|--------|
| 选择/移动标注框 | `S` 切换模式，点击框选中后拖拽 |
| 删除选中框 | `Delete` |
| 撤销 | `Ctrl + Z` |
| 重做 | `Ctrl + Y` |
| 手动保存 | `Ctrl + S` |
| 上一张/下一张图片 | `A` / `D` 或 `←` / `→` |
| 快速选类别 1-5 | `5` `6` `7` `8` `9` |
| 缩放重置 100% | `0` |
| 自适应窗口 | 双击 Canvas 空白区域 |
| 缩放 | `Ctrl + 滚轮` |
| 平移画布 | 右键拖拽 |
| 十字准星开关 | `H` |
| 切换审核状态 | `R` |

#### 属性面板

选中标注框后，右侧属性面板显示：
- 类别（可修改）
- 形状类型
- 中心坐标
- 宽高尺寸
- 删除按钮

---

## 输出文件

标注数据保存在：

```
projects/<项目ID>/
├── images/          ← 原始图片
├── labels/          ← YOLO TXT 标注文件
├── .meta/           ← 形状元数据（内部使用）
└── classes.json     ← 类别配置
```

或指定自定义标注目录后，TXT 文件保存在所选目录。

### YOLO TXT 格式

每行一个标注框：

```
class_id x_center y_center width height
```

- 所有坐标为归一化值（0~1），保留 6 位小数
- 可直接用于 YOLO 模型训练

示例：

```
0 0.523438 0.312500 0.089063 0.045185
2 0.122917 0.567593 0.034375 0.034537
4 0.750000 0.890185 0.210000 0.015000
```

---

## 项目结构

```
yolo_game_ui_labeler/
├── src-tauri/        Tauri Rust 源码（桌面壳）
├── labeler/          Django 后端（REST API）
├── static/           前端（HTML/CSS/JS）
├── templates/        Django 模板（浏览器开发用）
├── projects/         用户项目数据
├── manage.py         Django 入口
└── requirements.txt  Python 依赖
```

---

## 开发环境

### 浏览器调试

```bash
cd "D:\YOLO Game UI Labeler"
.\venv\Scripts\python.exe manage.py runserver
# 浏览器访问 http://127.0.0.1:8000/
```

### 桌面开发

```bash
cd src-tauri
cargo tauri dev
```

### 编译

```bash
cd src-tauri
cargo build
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | Tauri 2.x (Rust) |
| 后端 | Django + Django REST Framework |
| 前端 | 原生 HTML/CSS/JS + Canvas API |
| 图片处理 | Pillow + OpenCV |
| 文件对话框 | rfd (Rust File Dialog) |
