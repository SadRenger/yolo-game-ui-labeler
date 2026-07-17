# Contributing to YOLO Game UI Labeler · 贡献指南

感谢你关注这个项目！欢迎任何形式的贡献。

*Thanks for checking out! All contributions are welcome.*

---

## 🐛 Bug Reports · 报告问题

发现 Bug？请提 [GitHub Issue](https://github.com/SadRenger/yolo-game-ui-labeler/issues/new)，尽量包含：

- **环境信息**：操作系统版本、应用版本
- **复现步骤**：做了什么 → 发生了什么 → 期望什么
- **截图**：界面截图或录屏

*Found a bug? Open an issue with: OS version, app version, steps to reproduce, and screenshots.*

---

## 💡 Feature Requests · 功能建议

欢迎提 Issue 讨论新功能。请说明：解决什么问题、期望的交互方式、参考的其他工具。

*Have an idea? Open an issue describing: the problem, how you'd like it to work, and any references.*

---

## 🔧 Development Setup · 开发环境

### 前置要求 / Prerequisites

| 工具 / Tool | 版本 / Version |
|---|---|
| Rust | stable (>= 1.77) |
| Python | >= 3.11 |
| Git | >= 2.40 |

### 快速启动 / Quick Start

```bash
git clone git@github.com:SadRenger/yolo-game-ui-labeler.git
cd yolo-game-ui-labeler

# 安装依赖
pip install -r requirements.txt

# 终端 1: 启动 Django 后端
python manage.py runserver

# 终端 2: 启动 Tauri 桌面壳
cd src-tauri
cargo tauri dev
```

---

## 📁 Project Conventions · 项目规范

### 分支 / Branches

```
feat/<name>     # 新功能
fix/<name>      # Bug 修复
docs/<name>     # 文档
refactor/<name> # 重构
```

### Commit 格式 / Commit Format

```
<type>: <简短描述>

<详细说明 (可选)>
```

Types: `feat` | `fix` | `docs` | `refactor` | `chore` | `test`

### 代码风格 / Code Style

- **前端**：2 空格缩进、单引号
- **Python**：PEP 8
- **Rust**：`cargo fmt` + `cargo clippy`

---

## 🙏 Acknowledgments · 致谢

- [Tauri](https://tauri.app/) — 桌面应用框架
- [Django](https://www.djangoproject.com/) — Web 框架
- [Ultralytics](https://github.com/ultralytics/ultralytics) — YOLO 生态

---

*Happy labeling! 🏷️*
