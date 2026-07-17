# YOLO Game UI Labeler

游戏 UI 标注桌面工具，支持矩形、正方形、椭圆、圆形标注，导出 YOLO TXT 格式直接用于模型训练。

## 安装

双击 `YOLO Game UI Labeler_1.0.0_x64-setup.exe` 安装，桌面自动生成快捷方式。不需要安装 Python 或任何其他依赖。

> 系统要求：Windows 10 1803+ 或 Windows 11

## 使用步骤

### 1. 准备类别文件

新建一个 `classes.json`，内容参考：

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

`id` 从 0 开始，`name` 建议编码形状信息（如 `Btn_Circle`），`color` 是标注框颜色。

### 2. 新建项目

双击桌面快捷方式启动，点击 **"+ 新建项目"**，填写：

- **项目名称**
- **图片目录** — 点击浏览选择图片文件夹
- **标注存放目录**（可选）— 不填默认保存在项目内
- **类别配置** — 选择准备好的 `classes.json`

### 3. 标注

1. 顶部下拉框选择类别
2. 底部工具栏选形状（或按 `1`-`4`）
3. 在图片上拖拽画框，自动保存

### 4. 切换图片

按 `D` / `A` 前后切换，或点击左侧缩略图。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `1` `2` `3` `4` | 矩形 / 正方形 / 椭圆 / 圆形 |
| `S` | 选择/移动模式 |
| `Delete` | 删除选中框 |
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |
| `Ctrl+S` | 手动保存 |
| `A` `D` / `←` `→` | 上一张 / 下一张 |
| `5`-`9` | 快速切换类别 1-5 |
| `Ctrl+滚轮` | 缩放 |
| 右键拖拽 | 平移 |
| `0` | 缩放 100% |
| 双击空白 | 自适应窗口 |
| `H` | 十字准星开关 |
| `R` | 审核标记开关 |

> 拖拽时按住 `Shift` 可临时切换正方形↔矩形、圆形↔椭圆。

## 输出格式

标注文件以 YOLO TXT 格式保存，与图片同名：

```
labels/
├── screenshot_001.txt
├── screenshot_002.txt
└── ...
```

每行一个标注：`class_id x_center y_center width height`，坐标归一化到 0~1，保留 6 位小数。可直接用于 YOLO 训练。
