# YOLO Game UI Labeler — 开发实施计划书

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于 Tauri + Django + 原生 HTML/CSS/JS + Canvas 的**桌面标注工具**，支持 4 种形状标注、YOLO TXT 格式导出用于 YOLO 模型训练。形状信息通过类别命名约定（如 `Btn_Circle`）编码，推理时 class name 即包含形状信息。

**Architecture:** Tauri 2.x 作为桌面壳（Rust），管理窗口、系统托盘、原生文件对话框和 Django sidecar 生命周期。Django 提供 REST API 和静态文件服务，前端在 Tauri WebView 中渲染为单页应用（项目选择页 + 标注主界面），HTML5 Canvas 处理所有图形渲染与鼠标交互，标注数据以 YOLO TXT 格式即时写入文件系统。

**Tech Stack:** Tauri 2.x (Rust), Django 6.x, Django REST Framework, Pillow, opencv-python, HTML5 Canvas API, 原生 JavaScript (ES6+), CSS3

## Global Constraints

- 桌面原生应用，纯本地运行，无需数据库，文件系统存储所有数据
- 标注坐标始终基于原始图片分辨率（缩放/平移仅改变视图）
- YOLO TXT 归一化坐标保留 6 位小数
- 最小标注尺寸 3px，小于此值静默忽略
- WebView 引擎：Windows 用 WebView2 (Edge Chromium)，macOS 用 WKWebView
- 项目名称仅允许字母、数字、下划线、中文
- 支持图片格式：.jpg、.jpeg、.png
- Undo 栈上限 50 步，跨图片切换时清空
- Tauri 单实例运行，防止多窗口数据竞争

---

## 文件结构总览

```
yolo_game_ui_labeler/
├── src-tauri/                          # Tauri Rust 源码
│   ├── Cargo.toml                      # Rust 依赖
│   ├── tauri.conf.json                 # Tauri 配置（窗口尺寸、sidecar、打包）
│   ├── capabilities/
│   │   └── default.json                # 权限声明（dialog, shell, fs）
│   ├── icons/                          # 应用图标（各尺寸 PNG + .ico/.icns）
│   └── src/
│       ├── main.rs                     # 入口：启动 Django sidecar，创建窗口
│       └── lib.rs                      # Tauri commands：文件对话框等
├── manage.py                           # Django 入口
├── requirements.txt                    # Python 依赖清单
├── labeler/                            # Django 应用
│   ├── __init__.py
│   ├── settings.py                     # 配置（静态文件、项目根目录）
│   ├── urls.py                         # URL 路由
│   ├── views.py                        # 所有 API 视图
│   └── utils.py                        # 工具函数（坐标转换、缩略图、原子写入、完整性校验）
├── templates/
│   ├── index.html                      # 标注主界面
│   └── projects.html                   # 项目选择页面
├── static/
│   ├── css/
│   │   └── app.css                     # 全局样式
│   └── js/
│       ├── api.js                      # API 请求封装（Tauri IPC 适配层）
│       ├── projects.js                 # 项目选择页面逻辑（Tauri 原生对话框）
│       ├── app.js                      # 标注主界面入口 & 全局状态
│       ├── canvas.js                   # Canvas 渲染引擎 & 鼠标交互
│       ├── annotation.js               # 标注数据模型 & undo/redo 栈
│       ├── sidebar.js                  # 图片列表侧边栏
│       └── toolbar.js                  # 工具栏 & 快捷键绑定
└── projects/                           # 用户项目数据目录
    ├── .projects.json                  # 项目注册表
    └── <project_name>/
        ├── images/                     # 原始图片
        ├── labels/                     # YOLO TXT 标注文件
        ├── .meta/                      # 形状元数据 + 审核标记（内部使用）
        ├── classes.json                # 类别配置
        └── .thumbnails/                # 缩略图缓存
```

---

## Phase 0：Tauri 桌面壳 + Django 骨架

**目标**：Tauri 应用可启动，双击桌面图标自动拉起 Django 并显示项目选择页面。原生文件对话框可用。

### Task 0.1: 开发环境准备

- [ ] **Step 1: 安装 Rust 工具链**

```bash
# Windows
winget install Rustlang.Rustup
rustup default stable

# macOS
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

- [ ] **Step 2: 安装 Tauri CLI**

```bash
cargo install tauri-cli --version "^2"
```

- [ ] **Step 3: 安装 Python 依赖**

```bash
cd "D:\YOLO Game UI Labeler"
python -m venv venv
venv\Scripts\activate  # macOS: source venv/bin/activate
pip install django>=4.2,<5.0 djangorestframework>=3.14,<4.0 Pillow>=10.0,<11.0 opencv-python>=4.8,<5.0
pip freeze > requirements.txt
```

- [ ] **Step 4: Commit**

### Task 0.2: Django 项目初始化

**Files:**
- Create: `manage.py`
- Create: `labeler/__init__.py` (空文件)
- Create: `labeler/settings.py`
- Create: `labeler/urls.py`

等同于原纯 Web 方案的 Task 1.1，区别在于 `settings.py` 中 `ALLOWED_HOSTS` 仅限 `127.0.0.1`（不对外暴露），且 Django 端口固定为 `8000`。

- [ ] **Step 1: 创建 manage.py**

```python
#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'labeler.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: 创建 labeler/settings.py**

```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-yolo-game-ui-labeler-local-dev-key'
DEBUG = True
ALLOWED_HOSTS = ['127.0.0.1', 'localhost']

INSTALLED_APPS = [
    'django.contrib.staticfiles',
    'rest_framework',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'labeler.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': False,
        'OPTIONS': {'context_processors': []},
    },
]

STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']

PROJECTS_ROOT = BASE_DIR / 'projects'
os.makedirs(PROJECTS_ROOT, exist_ok=True)
```

- [ ] **Step 3: 创建 labeler/urls.py**（临时——Phase 1 填充）

```python
from django.urls import path
from django.shortcuts import render

def projects_page(request):
    return render(request, 'projects.html')

urlpatterns = [
    path('', projects_page, name='projects'),
]
```

- [ ] **Step 4: 创建空 templates/projects.html**（占位）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>YOLO Game UI Labeler</title></head>
<body><h1>Loading...</h1></body>
</html>
```

- [ ] **Step 5: 验证 Django 可独立启动**

```bash
python manage.py runserver 127.0.0.1:8000
# 浏览器访问 http://127.0.0.1:8000/ 应看到 "Loading..."
```

- [ ] **Step 6: Commit**

### Task 0.3: Tauri 项目初始化

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`

- [ ] **Step 1: 创建 src-tauri/Cargo.toml**

```toml
[package]
name = "yolo-game-ui-labeler"
version = "1.0.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

- [ ] **Step 2: 创建 src-tauri/tauri.conf.json**

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "YOLO Game UI Labeler",
  "version": "1.0.0",
  "identifier": "com.yolo-game-ui-labeler.app",
  "build": {
    "frontendDist": "../static",
    "devUrl": "http://127.0.0.1:8000",
    "beforeDevCommand": "",
    "beforeBuildCommand": ""
  },
  "app": {
    "title": "YOLO Game UI Labeler",
    "windows": [
      {
        "title": "YOLO Game UI Labeler",
        "width": 1400,
        "height": 900,
        "minWidth": 1024,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    },
    "withGlobalTauri": true
  },
  "plugins": {
    "dialog": {},
    "shell": {
      "scope": [
        {
          "name": "python",
          "cmd": "python",
          "args": true
        }
      ]
    },
    "fs": {
      "scope": ["**"]
    }
  }
}
```

- [ ] **Step 3: 创建 src-tauri/capabilities/default.json**

```json
{
  "identifier": "default",
  "description": "Default capability set",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "shell:default",
    "shell:allow-execute",
    "shell:allow-spawn",
    "fs:default",
    "fs:allow-read",
    "fs:allow-write",
    "fs:allow-exists"
  ]
}
```

- [ ] **Step 4: 创建 src-tauri/src/main.rs**（空壳——Phase 0.4 填充 sidecar 逻辑）

```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    yolo_game_ui_labeler_lib::run()
}
```

- [ ] **Step 5: 创建 src-tauri/src/lib.rs**（初期空壳）

```rust
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![pick_image_directory, pick_json_file])
        .setup(|app| {
            let _window = app.get_webview_window("main").unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 6: 创建 src-tauri/icons/** （放置应用图标，可从临时占位图开始）

- [ ] **Step 7: 验证 Tauri 可启动**

```bash
# 先启动 Django
python manage.py runserver 127.0.0.1:8000 &

# 再启动 Tauri dev 模式
cargo tauri dev
```

预期：Tauri 窗口打开，显示 Django 占位页面 "Loading..."。

- [ ] **Step 8: Commit**

### Task 0.4: Django Sidecar 生命周期管理

**Files:**
- Modify: `src-tauri/Cargo.toml` — 添加 `portpicker` 依赖
- Modify: `src-tauri/src/lib.rs` — 完整 sidecar 管理逻辑

- [ ] **Step 1: 更新 Cargo.toml 依赖**

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
portpicker = "0.1"
```

- [ ] **Step 2: 重写 src-tauri/src/lib.rs** —— sidecar 生命周期管理

```rust
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

struct DjangoProcess(Mutex<Option<Child>>);

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn start_django() -> Option<(Child, u16)> {
    // 自动选择可用端口（优先 8000）
    let port = portpicker::pick_unused_port().unwrap_or(8000);
    let port_str = port.to_string();
    let addr = format!("127.0.0.1:{}", port);

    let child = Command::new("python")
        .args(["manage.py", "runserver", &addr, "--noreload"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .ok()?;

    // 等待 Django 就绪（最多 10 秒）
    let start = std::time::Instant::now();
    loop {
        if start.elapsed().as_secs() > 10 {
            // 超时——尝试终止进程
            let _ = child.id().map(|id| {
                #[cfg(windows)]
                { std::process::Command::new("taskkill").args(["/F", "/PID", &id.to_string()]).spawn(); }
                #[cfg(not(windows))]
                { std::process::Command::new("kill").arg(id.to_string()).spawn(); }
            });
            return None;
        }
        if reqwest::blocking::get(format!("http://{}", addr)).is_ok() {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(300));
    }

    Some((child, port))
}

pub fn run() {
    let (django_child, port) = start_django()
        .expect("Failed to start Django server");

    let django = DjangoProcess(Mutex::new(Some(django_child)));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(django)
        .invoke_handler(tauri::generate_handler![pick_image_directory, pick_json_file])
        .setup(move |app| {
            // 单实例锁：尝试绑定固定本地端口，失败则已有实例运行
            use std::net::TcpListener;
            let lock_addr = "127.0.0.1:17839";
            let lock = match TcpListener::bind(lock_addr) {
                Ok(l) => l,
                Err(_) => {
                    // 端口被占用 → 已有实例运行 → 直接退出
                    std::process::exit(0);
                }
            };
            // 刻意泄漏 socket 以持有端口锁（进程存活期间）
            // 进程退出时 OS 自动回收端口
            std::mem::forget(lock);

            let window = app.get_webview_window("main").unwrap();

            // 如果是 devUrl 模式（cargo tauri dev），不重定向
            // 否则重定向到实际端口
            #[cfg(not(dev))]
            {
                let url = format!("http://127.0.0.1:{}", port);
                window.eval(&format!("window.location.href = '{}'", url)).ok();
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                if let Some(django) = app.try_state::<DjangoProcess>() {
                    if let Some(mut child) = django.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: 验证 sidecar 生命周期**

```bash
cargo tauri dev
```

预期：
- Tauri 窗口打开，自动显示 Django 页面
- 关闭窗口后，Django 进程自动终止（检查 `netstat -ano | findstr 8000`）

- [ ] **Step 4: Commit**

### Task 0.5: 原生文件对话框 Tauri Commands

**Files:**
- Modify: `src-tauri/src/lib.rs` — 添加 dialog commands
- Create: `static/js/api.js` — 前端 Tauri IPC 适配层

- [ ] **Step 1: 在 lib.rs 中添加文件对话框 Rust commands**

**设计决策：用 Rust command 包装 dialog 插件，避免前端依赖 npm 包。**

Tauri 2.x 的插件 JS API 需要通过 `@tauri-apps/plugin-dialog` npm 包导入，这与本项目"原生 JS 零打包工具"的前提冲突。解决方案：在 Rust 侧定义自己的 `#[tauri::command]`，内部调用 `tauri_plugin_dialog` 的 Rust API，前端仅通过 `window.__TAURI__.invoke('pick_image_directory')` 调用。`withGlobalTauri: true` 确保 `window.__TAURI__` 全局可用。

在 `src-tauri/src/lib.rs` 中添加两个 dialog commands：

```rust
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn pick_image_directory(app: tauri::AppHandle) -> Result<String, String> {
    let result = app
        .dialog()
        .file()
        .set_title("选择图片目录")
        .pick_folder();

    match result {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Ok(String::new()),  // 用户取消
    }
}

#[tauri::command]
async fn pick_json_file(app: tauri::AppHandle) -> Result<String, String> {
    let result = app
        .dialog()
        .file()
        .set_title("选择类别配置文件")
        .add_filter("JSON 文件", &["json"])
        .pick_file();

    match result {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Ok(String::new()),
    }
}
```

在 `builder` 的 `.invoke_handler` 中注册这些 commands（替换掉之前的 `greet`）。

- [ ] **Step 2: 前端通过 invoke 调用**

前端 `TauriBridge` 无需依赖任何 npm 包，直接用 `window.__TAURI__.invoke()`：

- [ ] **Step 3: 创建 static/js/api.js**（含 Tauri IPC 适配）

```javascript
// API 请求封装 + Tauri IPC 适配
const API = {
    base: 'http://127.0.0.1:8000',

    async request(method, url, body = null) {
        const opts = { method, headers: {} };
        if (body) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        const response = await fetch(this.base + url, opts);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data;
    },

    // 项目管理
    listProjects()     { return this.request('GET', '/api/projects/'); },
    createProject(data){ return this.request('POST', '/api/projects/', data); },
    getProject(id)     { return this.request('GET', `/api/projects/${id}/`); },
    deleteProject(id)  { return this.request('DELETE', `/api/projects/${id}/`); },

    // 图片
    getImages(projectId, params = '') {
        return this.request('GET', `/api/projects/${projectId}/images/?${params}`);
    },
    getImageDetail(projectId, name) {
        return this.request('GET', `/api/projects/${projectId}/images/${encodeURIComponent(name)}/`);
    },
    getImageDataUrl(projectId, name) {
        return `${this.base}/api/projects/${projectId}/images/${encodeURIComponent(name)}/data/`;
    },
    getThumbnailUrl(projectId, name) {
        return `${this.base}/api/projects/${projectId}/images/${encodeURIComponent(name)}/thumbnail/`;
    },

    // 标注
    saveAnnotations(projectId, name, annotations) {
        return this.request('PUT',
            `/api/projects/${projectId}/images/${encodeURIComponent(name)}/annotations/`,
            { annotations });
    },

    // 审核状态
    toggleReviewed(projectId, name, reviewed) {
        return this.request('PUT',
            `/api/projects/${projectId}/images/${encodeURIComponent(name)}/reviewed/`,
            { reviewed });
    },
};

// Tauri 原生对话框桥接
// 通过 window.__TAURI__.invoke() 调用 Rust 侧自定义 command，避免依赖 npm 包
const TauriBridge = {
    isAvailable: typeof window.__TAURI__ !== 'undefined'
                  && typeof window.__TAURI__.invoke !== 'undefined',

    /** 打开系统原生目录选择器，返回绝对路径 */
    async pickDirectory() {
        if (this.isAvailable) {
            try {
                const result = await window.__TAURI__.invoke('pick_image_directory');
                return result || '';
            } catch (e) {
                console.error('Tauri dialog error:', e);
            }
        }
        // 回退：纯浏览器开发调试时手动输入（cargo tauri dev 中仍可用）
        return prompt('请输入图片目录的绝对路径:') || '';
    },

    /** 打开系统原生文件选择器，过滤 .json */
    async pickJsonFile() {
        if (this.isAvailable) {
            try {
                const result = await window.__TAURI__.invoke('pick_json_file');
                return result || '';
            } catch (e) {
                console.error('Tauri dialog error:', e);
            }
        }
        return prompt('请输入类别配置 JSON 文件的绝对路径:') || '';
    },
};
```

- [ ] **Step 4: 验证原生对话框**

```bash
cargo tauri dev
# 在浏览器 DevTools console 中测试:
# await TauriBridge.pickDirectory()
```

预期：弹出系统原生文件夹选择器，选择后返回绝对路径。

- [ ] **Step 5: Commit**

### Task 0.6: 工具函数模块

**Files:**
- Create: `labeler/utils.py`

与之前 Task 1.2 内容完全相同：坐标转换、缩略图生成、TXT 读写、原子写入 `atomic_write`、完整性校验 `verify_project_integrity`。

（代码与之前审核过的版本一致，此处不再重复粘贴）

- [ ] **Step 1: 创建 labeler/utils.py**
- [ ] **Step 2: 验证 `python -c "from labeler.utils import *; print('OK')"`
- [ ] **Step 3: Commit**

### Phase 0 验收检查清单

- [ ] `cargo tauri dev` 可启动桌面窗口
- [ ] 关闭窗口时 Django 进程自动停止（端口 8000 释放）
- [ ] `TauriBridge.pickDirectory()` 弹出原生文件夹选择器并返回路径
- [ ] `python manage.py runserver` 仍可独立运行（开发调试用）
- [ ] 工具函数模块可通过 Django shell 正常导入

---

## Phase 1：标注核心功能（MVP）

**目标**：完整的项目→图片→标注→保存闭环，可在 Tauri 桌面窗口中正常使用。

### Task 1.1: API 视图 — 项目管理

**Files:**
- Create: `labeler/views.py`

**Interfaces:**
- Consumes: `labeler/utils.py` 中所有工具函数
- Produces:
  - `project_list(request)` → JSON (GET: 列表, POST: 创建)
  - `project_detail(request, project_id)` → JSON (GET: 详情, DELETE: 删除)

- [ ] **Step 1: 创建 labeler/views.py（项目管理部分）**

```python
#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'labeler.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
```

- [ ] **Step 3: 创建 labeler/__init__.py** (空文件)

- [ ] **Step 4: 创建 labeler/settings.py**

```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-yolo-game-ui-labeler-local-dev-key'
DEBUG = True
ALLOWED_HOSTS = ['127.0.0.1', 'localhost']

INSTALLED_APPS = [
    'django.contrib.staticfiles',
    'rest_framework',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'labeler.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': False,
        'OPTIONS': {
            'context_processors': [],
        },
    },
]

WSGI_APPLICATION = None  # 不使用 WSGI，仅开发服务器

STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']

# 项目数据存储根目录
PROJECTS_ROOT = BASE_DIR / 'projects'

# 确保项目根目录存在
os.makedirs(PROJECTS_ROOT, exist_ok=True)
```

- [ ] **Step 5: 创建 labeler/urls.py**

```python
from django.urls import path
from django.shortcuts import render
from . import views

def index(request):
    return render(request, 'index.html')

def projects_page(request):
    return render(request, 'projects.html')

urlpatterns = [
    # 页面路由
    path('', projects_page, name='projects'),
    path('annotate/<str:project_id>/', index, name='annotate'),

    # API 路由
    path('api/projects/', views.project_list, name='api_project_list'),
    path('api/projects/<str:project_id>/', views.project_detail, name='api_project_detail'),
    path('api/projects/<str:project_id>/images/', views.image_list, name='api_image_list'),
    path('api/projects/<str:project_id>/images/<path:image_name>/', views.image_detail, name='api_image_detail'),
    path('api/projects/<str:project_id>/images/<path:image_name>/data/', views.image_data, name='api_image_data'),
    path('api/projects/<str:project_id>/images/<path:image_name>/thumbnail/', views.image_thumbnail, name='api_image_thumbnail'),
    path('api/projects/<str:project_id>/images/<path:image_name>/annotations/', views.save_annotations, name='api_save_annotations'),
    path('api/projects/<str:project_id>/images/<path:image_name>/reviewed/', views.toggle_reviewed, name='api_toggle_reviewed'),
    path('api/projects/<str:project_id>/classes/', views.project_classes, name='api_project_classes'),
]
```

- [ ] **Step 6: 安装依赖并验证项目启动**

```bash
cd "D:\YOLO Game UI Labeler"
pip install -r requirements.txt
python manage.py runserver
```

预期输出: Django development server starting at http://127.0.0.1:8000/

- [ ] **Step 7: Commit**

```bash
git add requirements.txt manage.py labeler/
git commit -m "feat: initialize Django project with settings and URL routing"
```

### Task 1.2: 工具函数模块

**Files:**
- Create: `labeler/utils.py`

**Interfaces:**
- Consumes: (none — utility functions used by views)
- Produces:
  - `ensure_project_dir(project_id: str) -> Path` — 创建并返回项目目录
  - `load_project_registry() -> dict` — 加载 `.projects.json`
  - `save_project_registry(registry: dict) -> None` — 保存 `.projects.json`
  - `pixel_to_yolo(x1, y1, x2, y2, img_w, img_h) -> tuple` — 像素坐标转 YOLO 归一化
  - `yolo_to_pixel(cx, cy, w, h, img_w, img_h) -> tuple` — YOLO 归一化转像素
  - `generate_thumbnail(image_path, thumb_path, size=(160,90)) -> None` — 生成缩略图
  - `scan_images(directory) -> list` — 扫描图片文件
  - `read_txt_annotations(txt_path) -> list` — 读取 YOLO TXT 标注
  - `write_txt_annotations(txt_path, annotations) -> None` — 写入 YOLO TXT 标注

- [ ] **Step 1: 创建 labeler/utils.py**

```python
import os
import json
import re
from pathlib import Path
from django.conf import settings
from PIL import Image

PROJECTS_ROOT = settings.PROJECTS_ROOT
REGISTRY_FILE = PROJECTS_ROOT / '.projects.json'
VALID_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png'}
VALID_PROJECT_NAME = re.compile(r'^[\w一-鿿-]+$')
THUMBNAIL_SIZE = (160, 90)


def load_project_registry():
    """加载项目注册表，不存在则返回空 dict。"""
    if REGISTRY_FILE.exists():
        with open(REGISTRY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_project_registry(registry):
    """保存项目注册表。"""
    with open(REGISTRY_FILE, 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)


def ensure_project_dir(project_id):
    """确保项目目录结构存在，返回项目根 Path。"""
    project_dir = PROJECTS_ROOT / project_id
    for sub in ['images', 'labels', '.meta', '.thumbnails']:
        (project_dir / sub).mkdir(parents=True, exist_ok=True)
    return project_dir


def scan_images(directory):
    """扫描目录下所有支持的图片文件，返回按文件名排序的列表。"""
    directory = Path(directory)
    images = []
    if not directory.exists():
        return images
    for f in directory.iterdir():
        if f.is_file() and f.suffix.lower() in VALID_IMAGE_EXTENSIONS:
            images.append(f.name)
    # 自然排序
    images.sort(key=lambda n: [int(c) if c.isdigit() else c.lower()
                                for c in re.split(r'(\d+)', n)])
    return images


def generate_thumbnail(image_path, thumb_path, size=THUMBNAIL_SIZE):
    """生成缩略图并保存到 thumb_path。"""
    with Image.open(image_path) as img:
        img.thumbnail(size, Image.LANCZOS)
        img.save(thumb_path, format='JPEG', quality=75)


def pixel_to_yolo(x1, y1, x2, y2, img_w, img_h):
    """像素坐标 (对角点, 任意方向) → YOLO 归一化 (cx, cy, w, h)

    Returns: (class_id 不在此函数处理) → (cx, cy, w, h) 均为 0~1 浮点数
    """
    x_min, x_max = min(x1, x2), max(x1, x2)
    y_min, y_max = min(y1, y2), max(y1, y2)
    w = x_max - x_min
    h = y_max - y_min
    cx = x_min + w / 2
    cy = y_min + h / 2
    return (
        round(cx / img_w, 6),
        round(cy / img_h, 6),
        round(w / img_w, 6),
        round(h / img_h, 6),
    )


def yolo_to_pixel(cx, cy, w, h, img_w, img_h):
    """YOLO 归一化 → 像素坐标 (x1, y1, x2, y2)"""
    x_center = cx * img_w
    y_center = cy * img_h
    width = w * img_w
    height = h * img_h
    return (
        round(x_center - width / 2),
        round(y_center - height / 2),
        round(x_center + width / 2),
        round(y_center + height / 2),
    )


def read_txt_annotations(txt_path):
    """读取 YOLO 格式 TXT 文件，返回标注列表。

    每行格式: class_id x_center y_center width height
    Returns: [{'class_id': int, 'cx': float, 'cy': float, 'w': float, 'h': float}, ...]
    """
    annotations = []
    if not txt_path.exists():
        return annotations
    with open(txt_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 5:
                annotations.append({
                    'class_id': int(parts[0]),
                    'cx': float(parts[1]),
                    'cy': float(parts[2]),
                    'w': float(parts[3]),
                    'h': float(parts[4]),
                })
    return annotations


def write_txt_annotations(txt_path, annotations):
    """写入 YOLO 格式 TXT 文件。

    Args:
        txt_path: Path 对象
        annotations: [{'class_id': int, 'cx': float, 'cy': float, 'w': float, 'h': float}, ...]
    """
    if not annotations:
        # 如果标注列表为空，删除文件（清空标注）
        if txt_path.exists():
            txt_path.unlink()
        return
    with open(txt_path, 'w') as f:
        for ann in annotations:
            f.write(f"{ann['class_id']} {ann['cx']:.6f} {ann['cy']:.6f} "
                    f"{ann['w']:.6f} {ann['h']:.6f}\n")


def get_image_size(image_path):
    """获取图片尺寸 (width, height)。"""
    with Image.open(image_path) as img:
        return img.size


def atomic_write(path, write_func):
    """原子写入：先写同目录临时文件，成功后 os.replace 原子替换。

    避免写入过程中进程崩溃或磁盘满导致文件损坏。
    """
    tmp_path = path.parent / f".tmp_{path.name}"
    write_func(tmp_path)
    os.replace(tmp_path, path)  # 原子替换，跨平台支持


def verify_project_integrity(project_dir):
    """扫描 labels/ 与 .meta/ 的一致性，返回警告列表。

    Returns: [{'file': str, 'issue': str, 'severity': 'warning'|'error'}, ...]
    """
    warnings = []
    labels_dir = project_dir / 'labels'
    meta_dir = project_dir / '.meta'

    if not labels_dir.exists():
        return warnings

    for txt_file in labels_dir.glob('*.txt'):
        stem = txt_file.stem
        meta_file = meta_dir / f"{stem}.meta.json"
        reviewed_file = meta_dir / f"{stem}.reviewed.json"

        # TXT 存在但 .meta.json 不存在
        if txt_file.stat().st_size > 0 and not meta_file.exists():
            warnings.append({
                'file': stem, 'severity': 'warning',
                'issue': 'TXT 标注存在但形状元数据缺失，标注将以矩形+虚线显示',
            })

        # .meta.json 存在但 TXT 不存在或为空
        if meta_file.exists():
            txt_empty = not txt_file.exists() or txt_file.stat().st_size == 0
            if txt_empty:
                warnings.append({
                    'file': stem, 'severity': 'warning',
                    'issue': '形状元数据存在但无对应标注，将自动清理',
                })
                meta_file.unlink()  # 清理孤立文件

        # 行数不一致
        if txt_file.stat().st_size > 0 and meta_file.exists():
            txt_count = len(read_txt_annotations(txt_file))
            try:
                with open(meta_file, 'r', encoding='utf-8') as f:
                    meta_count = len(json.load(f))
                if txt_count != meta_count:
                    warnings.append({
                        'file': stem, 'severity': 'error',
                        'issue': f'TXT 有 {txt_count} 行但 .meta 有 {meta_count} 条，标注形状将回退为矩形',
                    })
            except (json.JSONDecodeError, IOError):
                warnings.append({
                    'file': stem, 'severity': 'error',
                    'issue': '.meta 文件损坏，标注形状将回退为矩形',
                })

        # 审核标记孤立检查
        if reviewed_file.exists():
            if not txt_file.exists() or txt_file.stat().st_size == 0:
                warnings.append({
                    'file': stem, 'severity': 'warning',
                    'issue': '审核标记存在但无标注，将自动清理',
                })
                reviewed_file.unlink()

    return warnings
```

- [ ] **Step 2: 验证工具函数可导入**

```bash
python -c "from labeler.utils import pixel_to_yolo, yolo_to_pixel, scan_images; print('OK')"
```

预期输出: `OK`

- [ ] **Step 3: Commit**

```bash
git add labeler/utils.py
git commit -m "feat: add utility functions for coordinate conversion, file I/O, thumbnails"
```

### Task 1.3: API 视图 — 项目管理

**Files:**
- Create: `labeler/views.py`

**Interfaces:**
- Consumes: `labeler/utils.py` 中所有工具函数
- Produces:
  - `project_list(request)` → JSON (GET: 列表, POST: 创建)
  - `project_detail(request, project_id)` → JSON (GET: 详情, DELETE: 删除)

- [ ] **Step 1: 创建 labeler/views.py（项目管理部分）**

```python
import json
import uuid
import shutil
from pathlib import Path
from datetime import datetime

from django.http import JsonResponse, HttpResponse, FileResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

from . import utils


def _json_response(data, status=200):
    """返回 JSON 响应。"""
    return JsonResponse(data, status=status, json_dumps_params={'ensure_ascii': False})


def _parse_body(request):
    """解析 JSON 请求体。"""
    try:
        return json.loads(request.body)
    except (json.JSONDecodeError, AttributeError):
        return {}


# ── 辅助函数 ────────────────────────────────────────────────

def _create_default_classes(project_dir):
    """创建默认空类别配置。"""
    default = {'classes': []}
    with open(project_dir / 'classes.json', 'w', encoding='utf-8') as f:
        json.dump(default, f, indent=2, ensure_ascii=False)


# ── 项目管理 API ────────────────────────────────────────────

@csrf_exempt
def project_list(request):
    """GET: 列出所有项目 / POST: 创建新项目"""
    registry = utils.load_project_registry()

    if request.method == 'GET':
        projects = []
        for pid, info in registry.items():
            project_dir = utils.PROJECTS_ROOT / pid
            projects.append({
                'id': pid,
                'name': info.get('name', pid),
                'image_count': info.get('image_count', 0),
                'annotated_count': info.get('annotated_count', 0),
                'last_opened': info.get('last_opened', ''),
                'exists': project_dir.exists(),
            })
        projects.sort(key=lambda p: p.get('last_opened', ''), reverse=True)
        return _json_response({'projects': projects})

    elif request.method == 'POST':
        body = _parse_body(request)
        name = body.get('name', '').strip()
        image_directory = body.get('image_directory', '').strip()
        class_config = body.get('class_config', '').strip()

        # 校验项目名称
        if not name or not utils.VALID_PROJECT_NAME.match(name):
            return _json_response(
                {'error': '项目名称仅允许字母、数字、下划线、中文'}, status=400)

        # 校验图片目录
        img_dir = Path(image_directory)
        if not img_dir.exists():
            return _json_response(
                {'error': f'图片目录不存在: {image_directory}'}, status=400)

        images = utils.scan_images(img_dir)
        if not images:
            return _json_response(
                {'error': f'图片目录中无支持的图片文件: {image_directory}'}, status=400)

        # 生成项目 ID
        project_id = str(uuid.uuid4())[:8]

        # 创建项目目录结构
        project_dir = utils.ensure_project_dir(project_id)

        # 处理类别配置
        if class_config:
            class_config_path = Path(class_config)
            if class_config_path.exists():
                shutil.copy(class_config_path, project_dir / 'classes.json')
            else:
                _create_default_classes(project_dir)
        else:
            _create_default_classes(project_dir)

        # 生成缩略图
        thumb_dir = project_dir / '.thumbnails'
        for img_name in images:
            src = img_dir / img_name
            thumb = thumb_dir / f"{img_name}.thumb.jpg"
            try:
                utils.generate_thumbnail(str(src), str(thumb))
            except Exception:
                pass  # 缩略图生成失败不影响项目创建

        # 记录到注册表
        registry[project_id] = {
            'name': name,
            'image_directory': str(img_dir.absolute()),
            'image_count': len(images),
            'annotated_count': 0,
            'created_at': datetime.now().isoformat(),
            'last_opened': datetime.now().isoformat(),
            'class_config_path': str(project_dir / 'classes.json'),
        }
        utils.save_project_registry(registry)

        return _json_response({
            'id': project_id,
            'name': name,
            'image_count': len(images),
            'created_at': registry[project_id]['created_at'],
        }, status=201)

    return _json_response({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def project_detail(request, project_id):
    """GET: 项目详情 / DELETE: 删除项目"""
    registry = utils.load_project_registry()

    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    if request.method == 'GET':
        info = registry[project_id]
        project_dir = utils.PROJECTS_ROOT / project_id

        # 启动时完整性检查
        integrity_warnings = utils.verify_project_integrity(project_dir)

        # 更新标注统计
        labels_dir = project_dir / 'labels'
        annotated_count = 0
        if labels_dir.exists():
            for f in labels_dir.iterdir():
                if f.suffix == '.txt' and f.stat().st_size > 0:
                    annotated_count += 1
        info['annotated_count'] = annotated_count
        info['image_count'] = len(utils.scan_images(project_dir / 'images'))

        # 更新最后打开时间
        info['last_opened'] = datetime.now().isoformat()
        utils.save_project_registry(registry)

        # 加载类别配置
        classes = []
        classes_path = project_dir / 'classes.json'
        if classes_path.exists():
            with open(classes_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                classes = data.get('classes', [])

        return _json_response({
            'id': project_id,
            'name': info['name'],
            'image_count': info['image_count'],
            'annotated_count': annotated_count,
            'classes': classes,
            'last_opened': info.get('last_opened', ''),
            'integrity_warnings': integrity_warnings,
        })

    elif request.method == 'DELETE':
        project_dir = utils.PROJECTS_ROOT / project_id
        if project_dir.exists():
            shutil.rmtree(project_dir)
        del registry[project_id]
        utils.save_project_registry(registry)
        return _json_response({'success': True})

    return _json_response({'error': 'Method not allowed'}, status=405)
```

- [ ] **Step 2: 启动服务器并测试项目管理 API**

```bash
python manage.py runserver &
```

测试项目列表（应为空）:
```bash
curl http://127.0.0.1:8000/api/projects/
# 预期: {"projects": []}
```

- [ ] **Step 3: Commit**

```bash
git add labeler/views.py
git commit -m "feat: add project management API (list, create, get, delete)"
```

### Task 1.2: API 视图 — 图片与标注

**Files:**
- Modify: `labeler/views.py` — 追加图片和标注相关视图

**Interfaces:**
- Consumes: `labeler/utils.py`
- Produces:
  - `image_list(request, project_id)` → JSON
  - `image_detail(request, project_id, image_name)` → JSON
  - `image_data(request, project_id, image_name)` → FileResponse
  - `image_thumbnail(request, project_id, image_name)` → FileResponse
  - `save_annotations(request, project_id, image_name)` → JSON

- [ ] **Step 1: 在 labeler/views.py 末尾追加图片 API 视图**

```python
# ── 图片 API ────────────────────────────────────────────────

@csrf_exempt
def image_list(request, project_id):
    """GET: 获取项目所有图片列表及状态"""
    registry = utils.load_project_registry()
    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    project_dir = utils.PROJECTS_ROOT / project_id
    images_dir = project_dir / 'images'
    labels_dir = project_dir / 'labels'

    status_filter = request.GET.get('status', 'all')
    page = int(request.GET.get('page', 1))
    per_page = int(request.GET.get('per_page', 100))

    all_images = utils.scan_images(images_dir)

    # 构建图片状态列表
    meta_dir = project_dir / '.meta'
    image_list_data = []
    for img_name in all_images:
        stem = Path(img_name).stem
        txt_path = labels_dir / f"{stem}.txt"
        reviewed_path = meta_dir / f"{stem}.reviewed.json"
        annotation_count = 0
        if txt_path.exists():
            anns = utils.read_txt_annotations(txt_path)
            annotation_count = len(anns)
        # 三态：已审核 > 已标注 > 未标注
        if reviewed_path.exists():
            status = 'reviewed'
        elif annotation_count > 0:
            status = 'annotated'
        else:
            status = 'unannotated'
        image_list_data.append({
            'file': img_name,
            'status': status,
            'annotation_count': annotation_count,
        })

    # 筛选
    if status_filter in ('reviewed', 'annotated', 'unannotated'):
        image_list_data = [i for i in image_list_data if i['status'] == status_filter]

    total = len(image_list_data)
    start = (page - 1) * per_page
    end = start + per_page
    page_data = image_list_data[start:end]

    return _json_response({
        'total': total,
        'page': page,
        'per_page': per_page,
        'images': page_data,
    })


def image_detail(request, project_id, image_name):
    """GET: 获取单张图片详情（尺寸 + 已有标注）"""
    registry = utils.load_project_registry()
    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    project_dir = utils.PROJECTS_ROOT / project_id
    image_path = project_dir / 'images' / image_name

    if not image_path.exists():
        return _json_response({'error': '图片不存在'}, status=404)

    img_w, img_h = utils.get_image_size(str(image_path))

    # 读取已有标注
    txt_path = project_dir / 'labels' / f"{Path(image_name).stem}.txt"
    raw_annotations = utils.read_txt_annotations(txt_path)

    # 转换为前端可用格式（像素坐标）
    # Phase 1: 从 .meta/ 读取形状信息（已在 Task 1.2 创建目录，Task 1.4 写入）
    meta_path = project_dir / '.meta' / f"{Path(image_name).stem}.meta.json"
    meta_list = []
    meta_mismatch = False
    if meta_path.exists():
        try:
            with open(meta_path, 'r', encoding='utf-8') as f:
                meta_list = json.load(f)
        except (json.JSONDecodeError, IOError):
            meta_list = []
        if len(meta_list) != len(raw_annotations):
            meta_mismatch = True

    annotations = []
    for i, ann in enumerate(raw_annotations):
        x1, y1, x2, y2 = utils.yolo_to_pixel(
            ann['cx'], ann['cy'], ann['w'], ann['h'], img_w, img_h)
        # 数量匹配时从 .meta 读取形状，不匹配时回退为 rect
        shape = 'rect'
        if i < len(meta_list) and not meta_mismatch:
            shape = meta_list[i].get('shape', 'rect')
        annotations.append({
            'id': '',  # 从 TXT 读取的标注无 ID，前端会分配
            'class_id': ann['class_id'],
            'shape': shape,
            'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
        })

    # 检查审核状态
    reviewed_path = project_dir / '.meta' / f"{Path(image_name).stem}.reviewed.json"
    if reviewed_path.exists():
        status = 'reviewed'
    elif annotations:
        status = 'annotated'
    else:
        status = 'unannotated'

    return _json_response({
        'file': image_name,
        'width': img_w,
        'height': img_h,
        'status': status,
        'annotations': annotations,
        'meta_mismatch': meta_mismatch,  # 前端据此显示警告横幅
    })


def image_data(request, project_id, image_name):
    """GET: 返回原图文件"""
    registry = utils.load_project_registry()
    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    image_path = utils.PROJECTS_ROOT / project_id / 'images' / image_name
    if not image_path.exists():
        return _json_response({'error': '图片不存在'}, status=404)

    return FileResponse(open(str(image_path), 'rb'), content_type='image/png')


def image_thumbnail(request, project_id, image_name):
    """GET: 返回缩略图"""
    thumb_path = utils.PROJECTS_ROOT / project_id / '.thumbnails' / f"{image_name}.thumb.jpg"
    if not thumb_path.exists():
        return _json_response({'error': '缩略图不存在'}, status=404)

    return FileResponse(open(str(thumb_path), 'rb'), content_type='image/jpeg')


@csrf_exempt
def save_annotations(request, project_id, image_name):
    """PUT: 保存该图片的标注数据（全量替换）"""
    if request.method != 'PUT':
        return _json_response({'error': 'Method not allowed'}, status=405)

    registry = utils.load_project_registry()
    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    project_dir = utils.PROJECTS_ROOT / project_id
    image_path = project_dir / 'images' / image_name
    if not image_path.exists():
        return _json_response({'error': '图片不存在'}, status=404)

    body = _parse_body(request)
    annotations_raw = body.get('annotations', [])
    img_w, img_h = utils.get_image_size(str(image_path))

    # 转换为 YOLO 归一化格式并写入 TXT
    yolo_annotations = []
    for ann in annotations_raw:
        cx, cy, w, h = utils.pixel_to_yolo(
            ann['x1'], ann['y1'], ann['x2'], ann['y2'], img_w, img_h)
        yolo_annotations.append({
            'class_id': ann['class_id'],
            'cx': cx, 'cy': cy, 'w': w, 'h': h,
        })

    txt_path = project_dir / 'labels' / f"{Path(image_name).stem}.txt"
    # 原子写入 TXT（防止写崩溃导致文件损坏）
    utils.atomic_write(txt_path, lambda p: utils.write_txt_annotations(p, yolo_annotations))

    # 保存形状元数据到 .meta/ —— 原子写入
    meta_dir = project_dir / '.meta'
    meta_path = meta_dir / f"{Path(image_name).stem}.meta.json"
    meta_data = []
    for ann in annotations_raw:
        meta_data.append({
            'class_id': ann['class_id'],
            'shape': ann.get('shape', 'rect'),
        })
    utils.atomic_write(meta_path, lambda p: _write_json(p, meta_data))

    # 更新项目注册表中的统计
    labels_dir = project_dir / 'labels'
    annotated_count = 0
    if labels_dir.exists():
        for f in labels_dir.iterdir():
            if f.suffix == '.txt' and f.stat().st_size > 0:
                annotated_count += 1
    registry[project_id]['annotated_count'] = annotated_count
    utils.save_project_registry(registry)

    # 如果标注列表为空，清理对应的 TXT 和 meta 文件
    if not annotations_raw:
        if txt_path.exists():
            txt_path.unlink()
        if meta_path.exists():
            meta_path.unlink()

    return _json_response({'success': True, 'saved_count': len(yolo_annotations)})


@csrf_exempt
def toggle_reviewed(request, project_id, image_name):
    """PUT: 切换图片的审核状态"""
    if request.method != 'PUT':
        return _json_response({'error': 'Method not allowed'}, status=405)

    registry = utils.load_project_registry()
    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    body = _parse_body(request)
    reviewed = body.get('reviewed', False)

    meta_dir = utils.PROJECTS_ROOT / project_id / '.meta'
    stem = Path(image_name).stem
    reviewed_path = meta_dir / f"{stem}.reviewed.json"

    if reviewed:
        with open(reviewed_path, 'w', encoding='utf-8') as f:
            json.dump({'reviewed': True, 'timestamp': datetime.now().isoformat()}, f)
    else:
        if reviewed_path.exists():
            reviewed_path.unlink()

    return _json_response({'success': True, 'reviewed': reviewed})
```

- [ ] **Step 2: 验证图片 API**

用浏览器访问 `http://127.0.0.1:8000/api/projects/` 确认服务正常。

- [ ] **Step 3: Commit**

```bash
git add labeler/views.py
git commit -m "feat: add image list, detail, data, thumbnail, and annotation save APIs"
```

### Task 1.3: 项目选择页面

**Files:**
- Create: `templates/projects.html`
- Create: `static/js/api.js`
- Create: `static/js/projects.js`

**Interfaces:**
- Consumes: API endpoints (project_list, project create)
- Produces: 项目选择页面，可创建/打开/删除项目

- [ ] **Step 1: 创建 templates/projects.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YOLO Game UI Labeler</title>
    <link rel="stylesheet" href="/static/css/app.css">
</head>
<body class="projects-page">
    <div class="projects-container">
        <header class="projects-header">
            <h1>YOLO Game UI Labeler</h1>
            <p class="subtitle">游戏 UI 标注工具</p>
        </header>

        <section class="projects-list" id="projectsList">
            <div class="loading">加载中...</div>
        </section>

        <button class="btn-primary btn-new-project" id="btnNewProject">+ 新建项目</button>
    </div>

    <!-- 新建项目对话框 -->
    <div class="modal-overlay" id="modalOverlay" style="display:none;">
        <div class="modal-dialog">
            <h2>新建标注项目</h2>
            <div class="form-group">
                <label for="projectName">项目名称</label>
                <input type="text" id="projectName" placeholder="例如：my_project">
            </div>
            <div class="form-group">
                <label for="imageDirectory">图片目录</label>
                <div class="input-with-browse">
                    <input type="text" id="imageDirectory" placeholder="D:\game_screenshots">
                    <button class="btn-browse" id="btnBrowseImage">浏览</button>
                </div>
                <input type="file" id="imageDirPicker" webkitdirectory style="display:none;">
            </div>
            <div class="form-group">
                <label for="classConfig">类别配置 (可选)</label>
                <div class="input-with-browse">
                    <input type="text" id="classConfig" placeholder="D:\classes.json">
                    <button class="btn-browse" id="btnBrowseClass">浏览</button>
                </div>
                <input type="file" id="classFilePicker" accept=".json" style="display:none;">
            </div>
            <div class="form-actions">
                <button class="btn-cancel" id="btnCancel">取消</button>
                <button class="btn-primary" id="btnCreate">创建项目</button>
            </div>
            <div class="form-error" id="formError" style="display:none;"></div>
        </div>
    </div>

    <script src="/static/js/api.js"></script>
    <script src="/static/js/projects.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 static/js/api.js**

```javascript
// API 请求封装
const API = {
    base: '',

    async request(method, url, body = null) {
        const opts = {
            method,
            headers: {},
        };
        if (body) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        const response = await fetch(this.base + url, opts);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data;
    },

    // 项目管理
    listProjects()     { return this.request('GET', '/api/projects/'); },
    createProject(data){ return this.request('POST', '/api/projects/', data); },
    getProject(id)     { return this.request('GET', `/api/projects/${id}/`); },
    deleteProject(id)  { return this.request('DELETE', `/api/projects/${id}/`); },

    // 图片
    getImages(projectId, params = '') {
        return this.request('GET', `/api/projects/${projectId}/images/?${params}`);
    },
    getImageDetail(projectId, name) {
        return this.request('GET', `/api/projects/${projectId}/images/${encodeURIComponent(name)}/`);
    },
    getImageDataUrl(projectId, name) {
        return `/api/projects/${projectId}/images/${encodeURIComponent(name)}/data/`;
    },
    getThumbnailUrl(projectId, name) {
        return `/api/projects/${projectId}/images/${encodeURIComponent(name)}/thumbnail/`;
    },

    // 标注
    saveAnnotations(projectId, name, annotations) {
        return this.request('PUT',
            `/api/projects/${projectId}/images/${encodeURIComponent(name)}/annotations/`,
            { annotations });
    },

    // 审核状态
    toggleReviewed(projectId, name, reviewed) {
        return this.request('PUT',
            `/api/projects/${projectId}/images/${encodeURIComponent(name)}/reviewed/`,
            { reviewed });
    },
};
```

- [ ] **Step 3: 创建 static/js/projects.js**

```javascript
document.addEventListener('DOMContentLoaded', () => {
    loadProjects();

    document.getElementById('btnNewProject').addEventListener('click', openNewProjectDialog);
    document.getElementById('btnCancel').addEventListener('click', closeDialog);
    document.getElementById('btnCreate').addEventListener('click', createProject);
    document.getElementById('btnBrowseImage').addEventListener('click', () => {
        document.getElementById('imageDirPicker').click();
    });
    document.getElementById('btnBrowseClass').addEventListener('click', () => {
        document.getElementById('classFilePicker').click();
    });

    // 文件选择器：浏览器只给文件名，需要手动输入完整路径
    // 对于本地工具，用户直接在文本框中输入路径
    document.getElementById('imageDirPicker').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const path = e.target.files[0].webkitRelativePath;
            const dirName = path.split('/')[0];
            // 尝试获取完整路径（受浏览器安全限制，此处展示相对路径）
            document.getElementById('imageDirectory').value =
                e.target.files[0].path || dirName;
        }
    });
    document.getElementById('classFilePicker').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            document.getElementById('classConfig').value =
                e.target.files[0].path || e.target.files[0].name;
        }
    });
});

async function loadProjects() {
    const container = document.getElementById('projectsList');
    try {
        const data = await API.listProjects();
        const projects = data.projects || [];

        if (projects.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无项目<br>点击下方按钮创建第一个项目</div>';
            return;
        }

        container.innerHTML = projects.map(p => {
            const pct = p.image_count > 0
                ? Math.round(p.annotated_count / p.image_count * 100) : 0;
            return `
                <div class="project-card" data-id="${p.id}">
                    <div class="project-card-main" onclick="openProject('${p.id}')">
                        <span class="project-icon">📁</span>
                        <div class="project-info">
                            <div class="project-name">${escapeHtml(p.name)}</div>
                            <div class="project-meta">
                                ${p.image_count} 张图片 · 已标注 ${pct}%
                            </div>
                            <div class="project-date">最后修改: ${p.last_opened?.slice(0, 10) || '-'}</div>
                        </div>
                    </div>
                    <button class="btn-delete-project" onclick="deleteProject(event, '${p.id}')"
                            title="删除项目">🗑</button>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div class="error-state">加载失败: ${escapeHtml(err.message)}</div>`;
    }
}

function openProject(id) {
    window.location.href = `/annotate/${id}/`;
}

async function deleteProject(e, id) {
    e.stopPropagation();
    if (!confirm('确定要删除此项目？所有标注数据将被永久删除。')) return;
    try {
        await API.deleteProject(id);
        loadProjects();
    } catch (err) {
        alert('删除失败: ' + err.message);
    }
}

function openNewProjectDialog() {
    document.getElementById('modalOverlay').style.display = 'flex';
    document.getElementById('formError').style.display = 'none';
    document.getElementById('projectName').value = '';
    document.getElementById('imageDirectory').value = '';
    document.getElementById('classConfig').value = '';
}

function closeDialog() {
    document.getElementById('modalOverlay').style.display = 'none';
}

async function createProject() {
    const name = document.getElementById('projectName').value.trim();
    const image_directory = document.getElementById('imageDirectory').value.trim();
    const class_config = document.getElementById('classConfig').value.trim();
    const errorEl = document.getElementById('formError');

    if (!name || !image_directory) {
        errorEl.textContent = '请填写项目名称和图片目录';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const result = await API.createProject({ name, image_directory, class_config });
        window.location.href = `/annotate/${result.id}/`;
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
```

- [ ] **Step 4: Commit**

```bash
git add templates/projects.html static/js/api.js static/js/projects.js
git commit -m "feat: add project selection page with create/open/delete functionality"
```

### Task 1.4: 标注主界面 HTML 布局

**Files:**
- Create: `templates/index.html`
- Create: `static/css/app.css`

**Interfaces:**
- Consumes: (none — pure layout)
- Produces: 完整的标注界面 DOM 结构 + 全局样式

- [ ] **Step 1: 创建 templates/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YOLO Game UI Labeler - 标注</title>
    <link rel="stylesheet" href="/static/css/app.css">
</head>
<body class="annotate-page">
    <!-- 顶部栏 -->
    <header class="topbar" id="topbar">
        <div class="topbar-left">
            <a href="/" class="back-link" title="返回项目列表">← 项目列表</a>
            <span class="project-name" id="projectNameDisplay">加载中...</span>
        </div>
        <div class="topbar-right">
            <select id="classSelector" class="class-selector">
                <option value="">-- 选择类别 --</option>
            </select>
            <button class="btn-toolbar" id="btnSave" title="Ctrl+S">💾 保存</button>
        </div>
    </header>

    <!-- 主区域 -->
    <div class="main-area">
        <!-- 左侧图片列表 -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-filters">
                <button class="filter-btn active" data-filter="all">全部</button>
                <button class="filter-btn" data-filter="reviewed">已审核</button>
                <button class="filter-btn" data-filter="annotated">已标注</button>
                <button class="filter-btn" data-filter="unannotated">未标注</button>
            </div>
            <div class="image-list" id="imageList">
                <div class="loading">加载中...</div>
            </div>
        </aside>

        <!-- 中央画布 -->
        <main class="canvas-area" id="canvasArea">
            <canvas id="mainCanvas"></canvas>
            <div class="canvas-watermark" id="watermark">暂无图片</div>
            <div class="zoom-indicator" id="zoomIndicator">100%</div>
        </main>

        <!-- 右侧属性面板 -->
        <aside class="property-panel" id="propertyPanel" style="display:none;">
            <h3>标注属性</h3>
            <div class="prop-group">
                <label>类别</label>
                <select id="propClass"></select>
            </div>
            <div class="prop-group">
                <label>形状</label>
                <span id="propShape" class="prop-value"></span>
            </div>
            <div class="prop-group">
                <label>中心坐标</label>
                <span id="propCenter" class="prop-value"></span>
            </div>
            <div class="prop-group">
                <label>尺寸 (宽×高)</label>
                <span id="propSize" class="prop-value"></span>
            </div>
            <button class="btn-danger" id="btnDeleteAnnotation">🗑 删除标注</button>
        </aside>
    </div>

    <!-- 底部工具栏 -->
    <footer class="bottombar" id="bottombar">
        <div class="toolbar-left">
            <span class="tool-group-label">标注工具:</span>
            <button class="tool-btn" data-tool="rect" title="矩形 (1)">▬ 矩形</button>
            <button class="tool-btn" data-tool="square" title="正方形 (2)">◻ 正方形</button>
            <button class="tool-btn" data-tool="ellipse" title="椭圆 (3)">◯ 椭圆</button>
            <button class="tool-btn" data-tool="circle" title="圆形 (4)">● 圆形</button>
            <button class="tool-btn" data-tool="select" title="选择/移动 (S)">🖱 选择</button>
        </div>
        <div class="toolbar-right">
            <span class="status-item" id="statusImageIndex">-/-</span>
            <span class="status-separator">|</span>
            <span class="status-item" id="statusAnnotationCount">标注: 0</span>
            <span class="status-separator">|</span>
            <span class="status-item" id="statusZoom">100%</span>
            <span class="status-separator">|</span>
            <span class="status-item" id="statusCrosshair">准星: 开</span>
        </div>
    </footer>

    <script src="/static/js/api.js"></script>
    <script src="/static/js/annotation.js"></script>
    <script src="/static/js/canvas.js"></script>
    <script src="/static/js/sidebar.js"></script>
    <script src="/static/js/toolbar.js"></script>
    <script src="/static/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 static/css/app.css**

```css
/* ── Reset & Base ───────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
    --bg-dark: #1e1e1e;
    --bg-mid: #252525;
    --bg-canvas: #2d2d2d;
    --bg-hover: #3a3a3a;
    --text-primary: #e0e0e0;
    --text-secondary: #999;
    --accent: #4a9eff;
    --accent-hover: #3a8eef;
    --danger: #e05555;
    --danger-hover: #c04444;
    --border: #404040;
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
}
html, body {
    height: 100%; font-family: var(--font); font-size: 14px;
    color: var(--text-primary); background: var(--bg-dark);
}

/* ── Buttons ────────────────────────────────────────────── */
.btn-primary {
    padding: 8px 24px; background: var(--accent); color: #fff;
    border: none; border-radius: 4px; cursor: pointer; font-size: 14px;
}
.btn-primary:hover { background: var(--accent-hover); }
.btn-cancel {
    padding: 8px 24px; background: transparent; color: var(--text-secondary);
    border: 1px solid var(--border); border-radius: 4px; cursor: pointer;
}
.btn-cancel:hover { background: var(--bg-hover); }
.btn-danger {
    width: 100%; padding: 8px; background: var(--danger); color: #fff;
    border: none; border-radius: 4px; cursor: pointer; margin-top: 12px;
}
.btn-danger:hover { background: var(--danger-hover); }
.btn-toolbar {
    padding: 6px 12px; background: transparent; color: var(--text-primary);
    border: 1px solid var(--border); border-radius: 4px; cursor: pointer;
    font-size: 13px;
}
.btn-toolbar:hover { background: var(--bg-hover); }
/* ── Project Selection Page ─────────────────────────────── */
.projects-page {
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; background: var(--bg-dark);
}
.projects-container {
    width: 520px; max-width: 90vw;
}
.projects-header {
    text-align: center; margin-bottom: 32px;
}
.projects-header h1 { font-size: 28px; margin-bottom: 8px; }
.projects-header .subtitle { color: var(--text-secondary); font-size: 16px; }
.project-card {
    display: flex; align-items: center; padding: 16px; margin-bottom: 8px;
    background: var(--bg-mid); border: 1px solid var(--border); border-radius: 8px;
    transition: border-color 0.2s;
}
.project-card:hover { border-color: var(--accent); }
.project-card-main {
    flex: 1; display: flex; align-items: center; gap: 12px; cursor: pointer;
}
.project-icon { font-size: 32px; }
.project-name { font-size: 16px; font-weight: 600; }
.project-meta { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.project-date { font-size: 12px; color: var(--text-secondary); }
.btn-delete-project {
    padding: 4px 8px; background: transparent; border: none; cursor: pointer;
    font-size: 16px; opacity: 0; transition: opacity 0.2s;
}
.project-card:hover .btn-delete-project { opacity: 1; }
.btn-new-project {
    display: block; width: 100%; margin-top: 16px; padding: 12px;
    font-size: 16px;
}
.empty-state, .error-state {
    text-align: center; padding: 40px; color: var(--text-secondary);
}

/* ── Modal ──────────────────────────────────────────────── */
.modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal-dialog {
    width: 480px; max-width: 90vw; background: var(--bg-mid);
    border-radius: 8px; padding: 24px;
}
.modal-dialog h2 { margin-bottom: 20px; font-size: 18px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; color: var(--text-secondary); font-size: 13px; }
.form-group input[type="text"] {
    width: 100%; padding: 8px 12px; background: var(--bg-dark);
    border: 1px solid var(--border); border-radius: 4px;
    color: var(--text-primary); font-size: 14px;
}
.input-with-browse { display: flex; gap: 8px; }
.input-with-browse input { flex: 1; }
.btn-browse {
    padding: 8px 12px; background: var(--bg-hover); color: var(--text-primary);
    border: 1px solid var(--border); border-radius: 4px; cursor: pointer;
}
.form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.form-error {
    margin-top: 12px; padding: 8px; background: rgba(224,85,85,0.15);
    color: var(--danger); border-radius: 4px; font-size: 13px;
}

/* ── Annotation Page Layout ─────────────────────────────── */
.annotate-page {
    display: flex; flex-direction: column; height: 100vh; overflow: hidden;
}
.topbar {
    display: flex; align-items: center; justify-content: space-between;
    height: 48px; padding: 0 16px; background: var(--bg-dark);
    border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.topbar-left { display: flex; align-items: center; gap: 16px; }
.back-link { color: var(--text-secondary); text-decoration: none; font-size: 13px; }
.back-link:hover { color: var(--text-primary); }
.project-name { font-weight: 600; }
.topbar-right { display: flex; align-items: center; gap: 8px; }
.class-selector {
    padding: 6px 8px; background: var(--bg-mid); color: var(--text-primary);
    border: 1px solid var(--border); border-radius: 4px; font-size: 13px; min-width: 140px;
}

.main-area {
    flex: 1; display: flex; overflow: hidden;
}

/* ── Sidebar ────────────────────────────────────────────── */
.sidebar {
    width: 220px; min-width: 180px; background: var(--bg-mid);
    border-right: 1px solid var(--border); display: flex; flex-direction: column;
    overflow: hidden;
}
.sidebar-filters {
    display: flex; padding: 8px; gap: 4px; border-bottom: 1px solid var(--border);
}
.filter-btn {
    flex: 1; padding: 4px 0; background: transparent; color: var(--text-secondary);
    border: 1px solid transparent; border-radius: 4px; cursor: pointer; font-size: 12px;
}
.filter-btn.active { color: var(--accent); border-color: var(--accent); }
.image-list { flex: 1; overflow-y: auto; }
.image-list .loading { padding: 20px; text-align: center; color: var(--text-secondary); }
.image-item {
    display: flex; align-items: center; gap: 8px; padding: 6px 8px; cursor: pointer;
    border-bottom: 1px solid rgba(64,64,64,0.3); transition: background 0.15s;
}
.image-item:hover { background: var(--bg-hover); }
.image-item.active { background: var(--bg-hover); border-left: 3px solid var(--accent); }
.image-item .thumb {
    width: 80px; height: 45px; object-fit: cover; border-radius: 2px;
    background: var(--bg-dark); flex-shrink: 0;
}
.image-item .file-info { flex: 1; min-width: 0; }
.image-item .file-name {
    font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.image-item .file-status { font-size: 11px; margin-top: 2px; }
.image-item .status-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px;
}
.status-dot.reviewed { background: #4caf50; }
.status-dot.annotated { background: #ffc107; }
.status-dot.unannotated { background: #666; }

/* ── Canvas ─────────────────────────────────────────────── */
.canvas-area {
    flex: 1; position: relative; background: var(--bg-canvas);
    overflow: hidden; cursor: crosshair;
}
.canvas-area.select-mode { cursor: default; }
#mainCanvas {
    position: absolute; top: 0; left: 0;
}
.canvas-watermark {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    color: rgba(255,255,255,0.12); font-size: 32px; pointer-events: none;
    display: none;
}
.zoom-indicator {
    position: absolute; bottom: 8px; right: 8px; font-size: 12px; color: var(--text-secondary);
    background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 4px;
    pointer-events: none;
}

/* ── Property Panel ─────────────────────────────────────── */
.property-panel {
    width: 200px; background: var(--bg-mid); border-left: 1px solid var(--border);
    padding: 12px; overflow-y: auto; flex-shrink: 0;
}
.property-panel h3 { font-size: 14px; margin-bottom: 12px; }
.prop-group { margin-bottom: 12px; }
.prop-group label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.prop-group select {
    width: 100%; padding: 6px; background: var(--bg-dark); color: var(--text-primary);
    border: 1px solid var(--border); border-radius: 4px; font-size: 13px;
}
.prop-value { font-size: 13px; color: var(--text-primary); }

/* ── Bottombar ──────────────────────────────────────────── */
.bottombar {
    display: flex; align-items: center; justify-content: space-between;
    height: 40px; padding: 0 16px; background: var(--bg-dark);
    border-top: 1px solid var(--border); flex-shrink: 0;
}
.toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 4px; }
.tool-group-label { font-size: 12px; color: var(--text-secondary); margin-right: 4px; }
.tool-btn {
    padding: 4px 10px; background: transparent; color: var(--text-primary);
    border: 1px solid var(--border); border-radius: 4px; cursor: pointer; font-size: 12px;
}
.tool-btn:hover { background: var(--bg-hover); }
.tool-btn.active { background: var(--accent); border-color: var(--accent); }
.status-item { font-size: 12px; color: var(--text-secondary); }
.status-separator { color: var(--border); font-size: 12px; margin: 0 4px; }
```

- [ ] **Step 2 (修正)**: 验证页面可通过 Django 访问

```bash
python manage.py runserver
```

浏览器访问 `http://127.0.0.1:8000/` 应显示项目选择页面。

- [ ] **Step 3: Commit**

```bash
git add templates/index.html static/css/app.css
git commit -m "feat: add annotation main interface HTML layout and global CSS styles"
```

### Task 1.5: 标注主界面入口 & 全局状态

**Files:**
- Create: `static/js/app.js`

**Interfaces:**
- Consumes: `api.js`, DOM from `index.html`
- Produces: 全局状态对象 `AppState`，项目加载逻辑，初始化流程

- [ ] **Step 1: 创建 static/js/app.js**

```javascript
// 全局应用状态
const AppState = {
    projectId: null,
    projectName: '',
    images: [],           // [{file, status, annotation_count}, ...]
    currentIndex: 0,      // 当前图片在 images 数组中的索引
    currentImage: null,   // HTML Image 元素
    currentAnnotations: [], // 当前图片的标注 [{id, class_id, shape, x1, y1, x2, y2}, ...]
    classes: [],           // [{id, name, color}, ...]
    selectedAnnotationId: null,

    // 便捷方法
    get currentFileName() {
        return this.images[this.currentIndex]?.file || '';
    },
    get currentAnnotation() {
        return this.currentAnnotations.find(a => a.id === this.selectedAnnotationId) || null;
    },
};

// 从 URL 提取项目 ID
const pathMatch = window.location.pathname.match(/\/annotate\/([^/]+)\//);
AppState.projectId = pathMatch ? pathMatch[1] : null;

if (!AppState.projectId) {
    window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadProject();
        await loadImageList();
        if (AppState.images.length > 0) {
            await loadImage(0);
        }
    } catch (err) {
        console.error('初始化失败:', err);
        alert('项目加载失败: ' + err.message);
    }
});

async function loadProject() {
    const data = await API.getProject(AppState.projectId);
    AppState.projectName = data.name;
    AppState.classes = data.classes || [];
    document.getElementById('projectNameDisplay').textContent = data.name;

    // 项目完整性警告
    if (data.integrity_warnings && data.integrity_warnings.length > 0) {
        const msgs = data.integrity_warnings.map(w =>
            `[${w.file}] ${w.issue}`
        ).join('\n');
        console.warn('项目完整性警告:\n' + msgs);
        showIntegrityWarning(
            `检测到 ${data.integrity_warnings.length} 个数据一致性问题，详见控制台。` +
            '标注形状可能显示不正确。'
        );
    }

    // 填充类别下拉框
    populateClassSelectors();
}

function populateClassSelectors() {
    const topSelector = document.getElementById('classSelector');
    const propSelector = document.getElementById('propClass');

    const optionsHtml = AppState.classes.map(c =>
        `<option value="${c.id}">${c.name}</option>`
    ).join('');

    topSelector.innerHTML = '<option value="">-- 选择类别 --</option>' + optionsHtml;
    if (propSelector) {
        propSelector.innerHTML = optionsHtml;
    }
}

async function loadImageList(statusFilter = 'all') {
    const data = await API.getImages(AppState.projectId, `status=${statusFilter}`);
    AppState.images = data.images || [];
    // sidebar.js 监听此事件
    document.dispatchEvent(new CustomEvent('imagelist:updated'));
}

async function loadImage(index) {
    if (index < 0 || index >= AppState.images.length) return;

    // 自动保存当前图片标注
    if (AppState.currentImage && AppState.currentAnnotations.length >= 0) {
        await saveCurrentAnnotations();
    }

    AppState.currentIndex = index;
    AppState.selectedAnnotationId = null;

    const fileName = AppState.currentFileName;
    const detail = await API.getImageDetail(AppState.projectId, fileName);

    // 加载图片
    const img = new Image();
    img.src = API.getImageDataUrl(AppState.projectId, fileName);
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('图片加载失败: ' + fileName));
    });
    AppState.currentImage = img;

    // 恢复标注（分配新 ID，因为 TXT 不保存 ID）
    AppState.currentAnnotations = (detail.annotations || []).map((ann, i) => ({
        ...ann,
        id: ann.id || generateId(),
    }));

    // .meta/ 一致性警告
    if (detail.meta_mismatch) {
        showIntegrityWarning(
            '⚠ 元数据不一致：标注形状信息可能丢失，已回退为矩形。请在属性面板中修正形状。'
        );
    }

    // 通知各组件
    document.dispatchEvent(new CustomEvent('image:loaded'));
}

async function saveCurrentAnnotations() {
    if (!AppState.currentFileName) return;
    const anns = AppState.currentAnnotations.map(a => ({
        class_id: a.class_id,
        shape: a.shape,
        x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2,
    }));
    try {
        await API.saveAnnotations(AppState.projectId, AppState.currentFileName, anns);
    } catch (err) {
        showStatusError('保存失败: ' + err.message);
    }
}

function generateId() {
    return 'ann_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function showStatusError(msg) {
    const el = document.getElementById('statusAnnotationCount');
    el.textContent = msg;
    el.style.color = 'var(--danger)';
    setTimeout(() => {
        el.style.color = '';
        updateStatusBar();
    }, 3000);
}

/** 显示跨图片的完整性警告横幅（Canvas 区域顶部） */
function showIntegrityWarning(msg) {
    let banner = document.getElementById('integrityBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'integrityBanner';
        banner.style.cssText = `
            position: absolute; top: 0; left: 0; right: 0;
            background: rgba(255, 193, 7, 0.15);
            color: #ffc107; padding: 8px 16px;
            font-size: 13px; text-align: center;
            z-index: 10; cursor: pointer;
        `;
        banner.onclick = () => { banner.style.display = 'none'; };
        document.getElementById('canvasArea').appendChild(banner);
    }
    banner.textContent = msg + ' (点击关闭)';
    banner.style.display = 'block';
    // 5 秒后自动消失
    setTimeout(() => { banner.style.display = 'none'; }, 8000);
}

function updateStatusBar() {
    document.getElementById('statusImageIndex').textContent =
        `${AppState.currentIndex + 1}/${AppState.images.length}`;
    document.getElementById('statusAnnotationCount').textContent =
        `标注: ${AppState.currentAnnotations.length}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add static/js/app.js
git commit -m "feat: add annotation app entry point with global state management"
```

### Task 1.6: Canvas 渲染引擎 + 矩形标注

**Files:**
- Create: `static/js/canvas.js`

**Interfaces:**
- Consumes: `AppState` from `app.js`, DOM `#mainCanvas`
- Produces: Canvas 渲染引擎，矩形绘制交互，视图变换（缩放/平移）

- [ ] **Step 1: 创建 static/js/canvas.js（渲染与交互核心）**

```javascript
// ── Canvas 渲染引擎 ────────────────────────────────────────

const Canvas = {
    canvas: null,
    ctx: null,

    // 视图变换
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,

    // 当前工具
    currentTool: 'rect',  // 'rect' | 'square' | 'ellipse' | 'circle' | 'select'

    // 绘制状态
    isDrawing: false,
    drawStartX: 0,
    drawStartY: 0,
    drawCurrentX: 0,
    drawCurrentY: 0,

    // 移动状态
    isMoving: false,
    moveStartX: 0,
    moveStartY: 0,
    moveOrigX1: 0,
    moveOrigY1: 0,
    moveOrigX2: 0,
    moveOrigY2: 0,

    // 平移状态
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartOffsetX: 0,
    panStartOffsetY: 0,

    init() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this._bindEvents();
        this._fitToContainer();
        window.addEventListener('resize', () => this._fitToContainer());
    },

    _fitToContainer() {
        const area = document.getElementById('canvasArea');
        this.canvas.width = area.clientWidth;
        this.canvas.height = area.clientHeight;
        this.render();
    },

    // ── 坐标转换 ────────────────────────────────────────

    /** 屏幕坐标 → 图片坐标 */
    screenToImage(sx, sy) {
        return {
            x: (sx - this.offsetX) / this.scale,
            y: (sy - this.offsetY) / this.scale,
        };
    },

    /** 图片坐标 → 屏幕坐标 */
    imageToScreen(ix, iy) {
        return {
            x: ix * this.scale + this.offsetX,
            y: iy * this.scale + this.offsetY,
        };
    },

    // ── 视图控制 ────────────────────────────────────────

    zoom(factor, centerX, centerY) {
        const newScale = Math.max(0.1, Math.min(5.0, this.scale * factor));
        // 以鼠标位置为中心缩放
        const imgPt = this.screenToImage(centerX, centerY);
        this.scale = newScale;
        const newScreen = this.imageToScreen(imgPt.x, imgPt.y);
        this.offsetX += centerX - newScreen.x;
        this.offsetY += centerY - newScreen.y;
        this.render();
        this._updateZoomDisplay();
    },

    zoomToFit() {
        if (!AppState.currentImage) return;
        const area = document.getElementById('canvasArea');
        const imgW = AppState.currentImage.width;
        const imgH = AppState.currentImage.height;
        const padX = area.clientWidth * 0.1;
        const padY = area.clientHeight * 0.1;
        const fitW = area.clientWidth - padX * 2;
        const fitH = area.clientHeight - padY * 2;
        this.scale = Math.min(fitW / imgW, fitH / imgH);
        this.offsetX = (area.clientWidth - imgW * this.scale) / 2;
        this.offsetY = (area.clientHeight - imgH * this.scale) / 2;
        this.render();
        this._updateZoomDisplay();
    },

    zoomTo100() {
        if (!AppState.currentImage) return;
        const area = document.getElementById('canvasArea');
        this.scale = 1.0;
        const imgW = AppState.currentImage.width;
        const imgH = AppState.currentImage.height;
        this.offsetX = (area.clientWidth - imgW) / 2;
        this.offsetY = (area.clientHeight - imgH) / 2;
        this.render();
        this._updateZoomDisplay();
    },

    _updateZoomDisplay() {
        const pct = Math.round(this.scale * 100);
        document.getElementById('zoomIndicator').textContent = pct + '%';
        document.getElementById('statusZoom').textContent = pct + '%';
    },

    // ── 渲染 ────────────────────────────────────────────

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        // 背景
        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(0, 0, w, h);

        if (!AppState.currentImage) {
            document.getElementById('watermark').style.display = 'block';
            return;
        }
        document.getElementById('watermark').style.display = 'none';

        // 绘制图片
        const img = AppState.currentImage;
        const screenPt = this.imageToScreen(0, 0);
        ctx.drawImage(img, screenPt.x, screenPt.y,
            img.width * this.scale, img.height * this.scale);

        // 绘制已确认的标注框
        for (const ann of AppState.currentAnnotations) {
            this._renderAnnotation(ann, false);
        }

        // 绘制正在拖拽的框（虚线预览）
        if (this.isDrawing) {
            this._renderDrawingPreview();
        }

        // 绘制十字准星
        if (Crosshair.visible) {
            Crosshair.render(this);
        }

        // 绘制图片边框
        const s0 = this.imageToScreen(0, 0);
        const s1 = this.imageToScreen(img.width, img.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(s0.x, s0.y, s1.x - s0.x, s1.y - s0.y);
    },

    _renderAnnotation(ann, isSelected) {
        const ctx = this.ctx;
        const cls = AppState.classes.find(c => c.id === ann.class_id);
        const color = cls ? cls.color : '#ffffff';
        const lineWidth = isSelected ? 4 : 2;

        // 外接矩形（屏幕坐标）
        const p1 = this.imageToScreen(ann.x1, ann.y1);
        const p2 = this.imageToScreen(ann.x2, ann.y2);
        const sx = Math.min(p1.x, p2.x);
        const sy = Math.min(p1.y, p2.y);
        const sw = Math.abs(p2.x - p1.x);
        const sh = Math.abs(p2.y - p1.y);

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;

        switch (ann.shape) {
            case 'rect':
            case 'square':
                ctx.strokeRect(sx, sy, sw, sh);
                break;
            case 'ellipse':
            case 'circle':
                ctx.beginPath();
                ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
        }

        // 标签
        if (cls) {
            ctx.fillStyle = color;
            ctx.font = '12px sans-serif';
            ctx.fillText(cls.name, sx, sy - 4);
        }
        ctx.restore();
    },

    _renderDrawingPreview() {
        if (!this.isDrawing) return;
        const p1 = this.imageToScreen(this.drawStartX, this.drawStartY);
        const p2 = this.imageToScreen(this.drawCurrentX, this.drawCurrentY);
        const sx = Math.min(p1.x, p2.x);
        const sy = Math.min(p1.y, p2.y);
        const sw = Math.abs(p2.x - p1.x);
        const sh = Math.abs(p2.y - p1.y);

        const ctx = this.ctx;
        ctx.save();
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        switch (this.currentTool) {
            case 'rect':
                ctx.strokeRect(sx, sy, sw, sh);
                break;
            case 'square': {
                const side = Math.max(sw, sh);
                ctx.strokeRect(sx, sy, side, side);
                break;
            }
            case 'ellipse':
                ctx.beginPath();
                ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'circle': {
                const dia = Math.max(sw, sh);
                ctx.beginPath();
                ctx.arc(sx + dia / 2, sy + dia / 2, dia / 2, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
        }
        ctx.restore();
    },

    // ── 事件绑定 ────────────────────────────────────────

    _bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        window.addEventListener('mouseup', (e) => this._onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this._onWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('dblclick', (e) => {
            if (!this._isOnAnnotation(e)) {
                this.zoomToFit();
            }
        });
    },

    _onMouseDown(e) {
        if (e.button === 2) {
            // 右键平移
            this.isPanning = true;
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            this.panStartOffsetX = this.offsetX;
            this.panStartOffsetY = this.offsetY;
            return;
        }
        if (e.button !== 0) return;

        const imgPt = this.screenToImage(e.offsetX, e.offsetY);

        if (this.currentTool === 'select') {
            // 检查是否点击了标注框
            const hit = this._hitTest(imgPt.x, imgPt.y);
            if (hit) {
                if (AppState.selectedAnnotationId === hit.id) {
                    // 开始移动
                    this.isMoving = true;
                    this.moveStartX = imgPt.x;
                    this.moveStartY = imgPt.y;
                    this.moveOrigX1 = hit.x1;
                    this.moveOrigY1 = hit.y1;
                    this.moveOrigX2 = hit.x2;
                    this.moveOrigY2 = hit.y2;
                } else {
                    AppState.selectedAnnotationId = hit.id;
                    document.dispatchEvent(new CustomEvent('annotation:selected'));
                    this.render();
                    // 如果点击的是重叠框中的下层，准备移动
                    this.isMoving = true;
                    this.moveStartX = imgPt.x;
                    this.moveStartY = imgPt.y;
                    this.moveOrigX1 = hit.x1;
                    this.moveOrigY1 = hit.y1;
                    this.moveOrigX2 = hit.x2;
                    this.moveOrigY2 = hit.y2;
                }
            } else {
                AppState.selectedAnnotationId = null;
                document.dispatchEvent(new CustomEvent('annotation:deselected'));
                this.render();
            }
        } else {
            // 开始绘制
            this.isDrawing = true;
            this.drawStartX = imgPt.x;
            this.drawStartY = imgPt.y;
            this.drawCurrentX = imgPt.x;
            this.drawCurrentY = imgPt.y;
        }
    },

    _onMouseMove(e) {
        if (this.isPanning) {
            this.offsetX = this.panStartOffsetX + (e.clientX - this.panStartX);
            this.offsetY = this.panStartOffsetY + (e.clientY - this.panStartY);
            this.render();
            return;
        }

        const imgPt = this.screenToImage(e.offsetX, e.offsetY);

        if (this.isDrawing) {
            this.drawCurrentX = imgPt.x;
            this.drawCurrentY = imgPt.y;
            this.render();
        } else if (this.isMoving) {
            const dx = imgPt.x - this.moveStartX;
            const dy = imgPt.y - this.moveStartY;
            const ann = AppState.currentAnnotation;
            if (ann) {
                ann.x1 = this.moveOrigX1 + dx;
                ann.y1 = this.moveOrigY1 + dy;
                ann.x2 = this.moveOrigX2 + dx;
                ann.y2 = this.moveOrigY2 + dy;
                this.render();
            }
        }
    },

    _onMouseUp(e) {
        if (e.button === 2) {
            this.isPanning = false;
            return;
        }
        if (e.button !== 0) return;

        if (this.isDrawing) {
            this.isDrawing = false;
            const dx = Math.abs(this.drawCurrentX - this.drawStartX);
            const dy = Math.abs(this.drawCurrentY - this.drawStartY);

            // 最小尺寸检查
            if (dx >= 3 && dy >= 3) {
                // 获取当前选中的类别
                const classSelector = document.getElementById('classSelector');
                const classId = parseInt(classSelector.value);
                if (isNaN(classId)) {
                    alert('请先选择类别');
                    this.render();
                    return;
                }

                const ann = {
                    id: generateId(),
                    class_id: classId,
                    shape: this.currentTool,
                    x1: this.drawStartX,
                    y1: this.drawStartY,
                    x2: this.drawCurrentX,
                    y2: this.drawCurrentY,
                };
                AppState.currentAnnotations.push(ann);
                AppState.selectedAnnotationId = ann.id;

                // 自动保存
                saveCurrentAnnotations();
                UndoStack.push({ type: 'create', annotation: ann });
                document.dispatchEvent(new CustomEvent('annotation:selected'));

                updateStatusBar();
            }
            this.render();
        }

        if (this.isMoving) {
            this.isMoving = false;
            const ann = AppState.currentAnnotation;
            if (ann) {
                const dx = ann.x1 - this.moveOrigX1;
                const dy = ann.y1 - this.moveOrigY1;
                if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                    UndoStack.push({
                        type: 'move',
                        annotationId: ann.id,
                        from: { x1: this.moveOrigX1, y1: this.moveOrigY1,
                                x2: this.moveOrigX2, y2: this.moveOrigY2 },
                        to: { x1: ann.x1, y1: ann.y1, x2: ann.x2, y2: ann.y2 },
                    });
                    saveCurrentAnnotations();
                }
            }
        }
    },

    _onWheel(e) {
        e.preventDefault();
        if (e.ctrlKey) {
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            this.zoom(factor, e.offsetX, e.offsetY);
        }
    },

    _hitTest(ix, iy) {
        // 从后往前遍历（最后创建的优先）
        for (let i = AppState.currentAnnotations.length - 1; i >= 0; i--) {
            const a = AppState.currentAnnotations[i];
            const xMin = Math.min(a.x1, a.x2);
            const xMax = Math.max(a.x1, a.x2);
            const yMin = Math.min(a.y1, a.y2);
            const yMax = Math.max(a.y1, a.y2);

            // 先用包围盒做快速剔除
            if (ix < xMin || ix > xMax || iy < yMin || iy > yMax) continue;

            // 矩形/正方形：包围盒即精确判定
            if (a.shape === 'rect' || a.shape === 'square') {
                return a;
            }

            // 椭圆/圆形：点-in-椭圆公式 (x-cx)²/rx² + (y-cy)²/ry² <= 1
            if (a.shape === 'ellipse' || a.shape === 'circle') {
                const cx = (a.x1 + a.x2) / 2;
                const cy = (a.y1 + a.y2) / 2;
                const rx = Math.abs(a.x2 - a.x1) / 2;
                const ry = Math.abs(a.y2 - a.y1) / 2;
                if (rx > 0 && ry > 0) {
                    const dx = (ix - cx) / rx;
                    const dy = (iy - cy) / ry;
                    if (dx * dx + dy * dy <= 1) return a;
                }
            }
        }
        return null;
    },

    _isOnAnnotation(e) {
        const imgPt = this.screenToImage(e.offsetX, e.offsetY);
        return this._hitTest(imgPt.x, imgPt.y) !== null;
    },
};

// ── 十字准星模块 ──────────────────────────────────────────

const Crosshair = {
    visible: true,

    render(canvas) {
        if (!AppState.currentImage) return;
        const img = AppState.currentImage;
        const cx = img.width / 2;
        const cy = img.height / 2;

        const sc = canvas.imageToScreen(cx, 0);
        const sc2 = canvas.imageToScreen(cx, img.height);
        const sc3 = canvas.imageToScreen(0, cy);
        const sc4 = canvas.imageToScreen(img.width, cy);

        const ctx = canvas.ctx;
        ctx.save();
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(sc.x, sc.y);
        ctx.lineTo(sc2.x, sc2.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(sc3.x, sc3.y);
        ctx.lineTo(sc4.x, sc4.y);
        ctx.stroke();

        ctx.restore();
    },
};
```

- [ ] **Step 2: 在 app.js 中初始化 Canvas**

在 `static/js/app.js` 的 `DOMContentLoaded` 回调末尾添加：

```javascript
    Canvas.init();
```

- [ ] **Step 3: 验证矩形标注功能**

启动服务器，创建项目加载图片，测试：
1. 选择一个类别
2. 点击矩形工具
3. 在图片上拖拽画矩形
4. 检查 `labels/` 目录是否生成了对应的 `.txt` 文件

- [ ] **Step 4: Commit**

```bash
git add static/js/canvas.js static/js/app.js
git commit -m "feat: add Canvas rendering engine, rectangle annotation tool, crosshair"
```

### Task 1.7: 图片列表侧边栏

**Files:**
- Create: `static/js/sidebar.js`

**Interfaces:**
- Consumes: `AppState`, `API`, DOM `#imageList`, `#sidebar`
- Produces: 图片列表渲染、筛选、点击跳转

- [ ] **Step 1: 创建 static/js/sidebar.js**

```javascript
// ── 图片列表侧边栏 ────────────────────────────────────────

const Sidebar = {
    currentFilter: 'all',

    init() {
        this._bindFilterButtons();
        document.addEventListener('imagelist:updated', () => this.render());
        document.addEventListener('image:loaded', () => this._highlightCurrent());
    },

    _bindFilterButtons() {
        const btns = document.querySelectorAll('.filter-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', async () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                await loadImageList(this.currentFilter);
                // 筛选后定位到第一张
                if (AppState.images.length > 0) {
                    await loadImage(0);
                }
            });
        });
    },

    render() {
        const container = document.getElementById('imageList');
        const images = AppState.images;

        if (images.length === 0) {
            container.innerHTML = '<div class="loading">暂无图片</div>';
            return;
        }

        container.innerHTML = images.map((img, idx) => {
            const statusLabels = { reviewed: '已审核', annotated: '已标注', unannotated: '未标注' };
            return `
            <div class="image-item ${idx === AppState.currentIndex ? 'active' : ''}"
                 data-index="${idx}" onclick="Sidebar.selectImage(${idx})">
                <img class="thumb"
                     src="${API.getThumbnailUrl(AppState.projectId, img.file)}"
                     alt="${img.file}"
                     loading="lazy"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2245%22><rect fill=%22%23333%22 width=%2280%22 height=%2245%22/></svg>'">
                <div class="file-info">
                    <div class="file-name" title="${img.file}">${img.file}</div>
                    <div class="file-status">
                        <span class="status-dot ${img.status}"></span>
                        ${statusLabels[img.status] || img.status}
                    </div>
                </div>
            </div>
        `}).join('');
    },

    async selectImage(index) {
        await loadImage(index);
    },

    _highlightCurrent() {
        const items = document.querySelectorAll('.image-item');
        items.forEach(item => {
            item.classList.toggle('active',
                parseInt(item.dataset.index) === AppState.currentIndex);
        });
        // 滚动到可视区域
        const active = document.querySelector('.image-item.active');
        if (active) {
            active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    },
};

Sidebar.init();
```

- [ ] **Step 2: Commit**

```bash
git add static/js/sidebar.js
git commit -m "feat: add image list sidebar with thumbnails, status filters, and click navigation"
```

### Task 1.8: 工具栏与快捷键

**Files:**
- Create: `static/js/toolbar.js`

**Interfaces:**
- Consumes: `AppState`, `Canvas`, DOM toolbar buttons
- Produces: 工具切换按钮 + 完整快捷键绑定

- [ ] **Step 1: 创建 static/js/toolbar.js**

```javascript
// ── 工具栏 & 快捷键 ────────────────────────────────────────

const Toolbar = {
    init() {
        this._bindToolButtons();
        this._bindKeyboard();
        this._bindTopButtons();
        // 默认选中矩形工具
        this._activateTool('rect');
    },

    _bindToolButtons() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this._activateTool(tool);
            });
        });
    },

    _activateTool(tool) {
        Canvas.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
        if (btn) btn.classList.add('active');

        // 更新画布光标
        const area = document.getElementById('canvasArea');
        area.classList.toggle('select-mode', tool === 'select');
    },

    _bindTopButtons() {
        document.getElementById('btnSave').addEventListener('click', async () => {
            await saveCurrentAnnotations();
            showStatusTemporary('已保存');
        });

    },

    _bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            // 不在输入框中响应快捷键
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            const ctrl = e.ctrlKey || e.metaKey;

            // Ctrl 组合键
            if (ctrl) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        UndoStack.undo();
                        break;
                    case 'y':
                        e.preventDefault();
                        UndoStack.redo();
                        break;
                    case 's':
                        e.preventDefault();
                        saveCurrentAnnotations();
                        showStatusTemporary('已保存');
                        break;
                }
                return;
            }

            // 单键
            switch (e.key.toLowerCase()) {
                case '1': this._activateTool('rect'); break;
                case '2': this._activateTool('square'); break;
                case '3': this._activateTool('ellipse'); break;
                case '4': this._activateTool('circle'); break;
                case 's': this._activateTool('select'); break;
                case '5': case '6': case '7': case '8': case '9':
                    // 快速切换到第 1-5 个类别
                    const classIdx = parseInt(e.key) - 5;
                    if (classIdx < AppState.classes.length) {
                        const cls = AppState.classes[classIdx];
                        document.getElementById('classSelector').value = cls.id;
                    }
                    break;
                case 'a':
                case 'arrowleft':
                    e.preventDefault();
                    this._navigateImage(-1);
                    break;
                case 'd':
                case 'arrowright':
                    e.preventDefault();
                    this._navigateImage(1);
                    break;
                case 'delete':
                    e.preventDefault();
                    this._deleteSelected();
                    break;
                case '0':
                    Canvas.zoomTo100();
                    break;
                case 'h':
                    Crosshair.visible = !Crosshair.visible;
                    document.getElementById('statusCrosshair').textContent =
                        '准星: ' + (Crosshair.visible ? '开' : '关');
                    Canvas.render();
                    break;
                case 'r':
                    ReviewManager.toggleCurrentImage();
                    break;
            }
        });
    },

    async _navigateImage(dir) {
        const newIdx = AppState.currentIndex + dir;
        if (newIdx >= 0 && newIdx < AppState.images.length) {
            await loadImage(newIdx);
        }
    },

    _deleteSelected() {
        const idx = AppState.currentAnnotations.findIndex(
            a => a.id === AppState.selectedAnnotationId);
        if (idx === -1) return;

        const ann = AppState.currentAnnotations[idx];
        UndoStack.push({ type: 'delete', annotation: ann, index: idx });
        AppState.currentAnnotations.splice(idx, 1);
        AppState.selectedAnnotationId = null;
        saveCurrentAnnotations();
        document.dispatchEvent(new CustomEvent('annotation:deselected'));
        Canvas.render();
        updateStatusBar();
    },
};

function showStatusTemporary(msg) {
    const el = document.getElementById('statusAnnotationCount');
    const orig = el.textContent;
    el.textContent = msg;
    setTimeout(() => { el.textContent = orig; }, 1500);
}

Toolbar.init();

// ── 审核状态管理 ──────────────────────────────────────────

const ReviewManager = {
    toggleCurrentImage() {
        if (!AppState.currentFileName) return;
        const fileName = AppState.currentFileName;
        const stem = fileName.replace(/\.[^.]+$/, '');

        // 切换审核状态：通过 API 写入/删除 .reviewed.json 标记文件
        const current = AppState.images[AppState.currentIndex];
        const newStatus = current.status === 'reviewed' ? 'annotated' : 'reviewed';

        API.toggleReviewed(AppState.projectId, fileName, newStatus === 'reviewed')
            .then(() => {
                current.status = newStatus;
                document.dispatchEvent(new CustomEvent('imagelist:updated'));
                updateStatusBar();
            })
            .catch(err => showStatusError('审核状态更新失败: ' + err.message));
    },
};
```

- [ ] **Step 2: Commit**

```bash
git add static/js/toolbar.js
git commit -m "feat: add toolbar, keyboard shortcuts, and review toggle"
```

---

### Phase 1 验收检查清单

- [ ] `cargo tauri dev` 可启动桌面窗口，Django 自动运行
- [ ] 项目选择页面可通过原生文件对话框新建项目
- [ ] 新建项目后自动跳转到标注界面
- [ ] 标注界面加载图片在 Canvas 中显示
- [ ] 左侧图片列表显示缩略图和三态标记
- [ ] 选择类别后可用矩形工具拖拽绘制标注框
- [ ] 绘制后 `labels/` 目录自动生成同名 `.txt` 和 `.meta/` 文件
- [ ] A/D 键切换图片，自动保存当前标注
- [ ] Ctrl+滚轮缩放，右键拖拽平移
- [ ] 十字准星默认显示，H 键切换
- [ ] 关闭窗口时 Django 进程自动停止

---

## Phase 2：形状扩展与编辑

### Task 2.1: 正方形、椭圆、圆形绘制逻辑

**Files:**
- Modify: `static/js/canvas.js` — 完善 `_renderDrawingPreview` 中的正方形/圆形逻辑

**说明**: 绘制预览逻辑已在 Phase 1 的 canvas.js 中实现（`_renderDrawingPreview` 已包含 square/circle 锁定逻辑）。此任务主要验证和完善。

- [ ] **Step 1: 实现 Shift 切换形状**

在 `_onMouseMove` 的 `isDrawing` 分支中计算 effective tool，作为参数传入 render：

```javascript
if (this.isDrawing) {
    // Shift 临时切换形状
    let effectiveTool = this.currentTool;
    if (e.shiftKey) {
        if (this.currentTool === 'rect') effectiveTool = 'square';
        else if (this.currentTool === 'square') effectiveTool = 'rect';
        else if (this.currentTool === 'ellipse') effectiveTool = 'circle';
        else if (this.currentTool === 'circle') effectiveTool = 'ellipse';
    }
    this.drawCurrentX = imgPt.x;
    this.drawCurrentY = imgPt.y;
    this.render(effectiveTool);  // 传入 effective tool 而非通过 this._shiftTool
}
```

修改 `render()` 签名：`render(effectiveTool = null)`，内部调用 `_renderDrawingPreview(effectiveTool || this.currentTool)`。

修改 `_renderDrawingPreview(tool)`：使用传入的 `tool` 参数替代 `this.currentTool`，移除对 `this._shiftTool` 的引用。

- [ ] **Step 2: 标注创建时使用正确的形状类型**

在 `_onMouseUp` 的 `isDrawing` 分支中记录 shape 时，同样计算 effective tool 并存入 annotation。抽取公共方法 `_getEffectiveTool(e)` 避免重复代码：

```javascript
_getEffectiveTool(e) {
    if (!e.shiftKey) return this.currentTool;
    const map = { rect: 'square', square: 'rect', ellipse: 'circle', circle: 'ellipse' };
    return map[this.currentTool] || this.currentTool;
},
```

- [ ] **Step 3: 测试四种形状的绘制和 TXT 导出**

逐一测试矩形、正方形、椭圆、圆形的绘制 → 检查 TXT 文件中归一化坐标是否正确。

- [ ] **Step 4: Commit**

```bash
git add static/js/canvas.js
git commit -m "feat: complete 4 shape drawing tools with Shift toggle"
```

### Task 2.2: Undo/Redo 栈

**Files:**
- Create: `static/js/annotation.js`

**Interfaces:**
- Consumes: `AppState`, `saveCurrentAnnotations()`, `Canvas.render()`
- Produces: `UndoStack` 全局对象，`undo()`, `redo()`, `push()` 方法

- [ ] **Step 1: 创建 static/js/annotation.js**

```javascript
// ── Undo/Redo 栈 ──────────────────────────────────────────

const UndoStack = {
    undoStack: [],
    redoStack: [],
    maxSize: 50,

    push(action) {
        // action: { type: 'create'|'delete'|'move'|'changeClass', ... }
        this.undoStack.push(action);
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }
        // 新操作清空 redo
        this.redoStack = [];
    },

    undo() {
        if (this.undoStack.length === 0) return;
        const action = this.undoStack.pop();
        this.redoStack.push(action);
        this._applyUndo(action);
        saveCurrentAnnotations();
        Canvas.render();
        updateStatusBar();
    },

    redo() {
        if (this.redoStack.length === 0) return;
        const action = this.redoStack.pop();
        this.undoStack.push(action);
        this._applyRedo(action);
        saveCurrentAnnotations();
        Canvas.render();
        updateStatusBar();
    },

    _applyUndo(action) {
        switch (action.type) {
            case 'create':
                // 撤销创建 = 删除
                const idx = AppState.currentAnnotations.findIndex(
                    a => a.id === action.annotation.id);
                if (idx !== -1) AppState.currentAnnotations.splice(idx, 1);
                if (AppState.selectedAnnotationId === action.annotation.id) {
                    AppState.selectedAnnotationId = null;
                    document.dispatchEvent(new CustomEvent('annotation:deselected'));
                }
                break;

            case 'delete':
                // 撤销删除 = 恢复
                AppState.currentAnnotations.splice(
                    action.index, 0, action.annotation);
                AppState.selectedAnnotationId = action.annotation.id;
                document.dispatchEvent(new CustomEvent('annotation:selected'));
                break;

            case 'move':
                // 撤销移动 = 移回原位
                const ann = AppState.currentAnnotations.find(
                    a => a.id === action.annotationId);
                if (ann) {
                    ann.x1 = action.from.x1;
                    ann.y1 = action.from.y1;
                    ann.x2 = action.from.x2;
                    ann.y2 = action.from.y2;
                }
                break;

            case 'changeClass':
                const a = AppState.currentAnnotations.find(
                    an => an.id === action.annotationId);
                if (a) {
                    a.class_id = action.from_class_id;
                    document.dispatchEvent(new CustomEvent('annotation:selected'));
                }
                break;
        }
    },

    _applyRedo(action) {
        switch (action.type) {
            case 'create':
                AppState.currentAnnotations.push(action.annotation);
                AppState.selectedAnnotationId = action.annotation.id;
                document.dispatchEvent(new CustomEvent('annotation:selected'));
                break;

            case 'delete':
                const idx = AppState.currentAnnotations.findIndex(
                    a => a.id === action.annotation.id);
                if (idx !== -1) AppState.currentAnnotations.splice(idx, 1);
                AppState.selectedAnnotationId = null;
                document.dispatchEvent(new CustomEvent('annotation:deselected'));
                break;

            case 'move':
                const ann = AppState.currentAnnotations.find(
                    a => a.id === action.annotationId);
                if (ann) {
                    ann.x1 = action.to.x1;
                    ann.y1 = action.to.y1;
                    ann.x2 = action.to.x2;
                    ann.y2 = action.to.y2;
                }
                break;

            case 'changeClass':
                const a = AppState.currentAnnotations.find(
                    an => an.id === action.annotationId);
                if (a) {
                    a.class_id = action.to_class_id;
                    document.dispatchEvent(new CustomEvent('annotation:selected'));
                }
                break;
        }
    },

    /** 切换图片时清空栈 */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    },
};
```

- [ ] **Step 2: 在 app.js 的 `loadImage()` 中清空 undo 栈**

在 `loadImage` 函数中，`AppState.currentIndex = index;` 后添加：

```javascript
    UndoStack.clear();
```

- [ ] **Step 3: 在 toolbar.js 中补充 changeClass 的 undo 记录**

工具栏中修改类别时（属性面板），需要压入 undo 栈。此功能在 Task 2.3 中完善。

- [ ] **Step 4: 测试 Ctrl+Z/Y**

画框 → Ctrl+Z 撤销 → Ctrl+Y 重做 → 验证

- [ ] **Step 5: Commit**

```bash
git add static/js/annotation.js static/js/app.js
git commit -m "feat: add undo/redo stack with create/delete/move/changeClass support"
```

### Task 2.3: 属性面板与标注编辑

**Files:**
- Modify: `static/js/canvas.js` — 选中框高亮渲染
- Modify: `static/js/app.js` — 属性面板事件绑定
- Modify: `static/js/toolbar.js` — 属性面板删除按钮、类别修改

- [ ] **Step 1: 验证选中框高亮渲染（已在 Phase 1 实现）**

`canvas.js` 的 `_renderAnnotation(ann, isSelected)` 已接受 `isSelected` 参数（线宽 2px → 4px，颜色为类别色）。`render()` 中遍历标注时已传入 `ann.id === AppState.selectedAnnotationId`。此步骤仅验证功能正常，无新增代码。

- [ ] **Step 2: 在 app.js 中添加属性面板事件处理**

在 `DOMContentLoaded` 回调末尾添加：

```javascript
// 属性面板事件
document.addEventListener('annotation:selected', () => {
    const ann = AppState.currentAnnotation;
    const panel = document.getElementById('propertyPanel');
    if (ann) {
        panel.style.display = 'block';
        const cls = AppState.classes.find(c => c.id === ann.class_id);
        document.getElementById('propClass').value = ann.class_id;
        document.getElementById('propShape').textContent = {
            rect: '矩形', square: '正方形', ellipse: '椭圆', circle: '圆形'
        }[ann.shape] || ann.shape;
        const cx = Math.round((ann.x1 + ann.x2) / 2);
        const cy = Math.round((ann.y1 + ann.y2) / 2);
        const w = Math.abs(ann.x2 - ann.x1);
        const h = Math.abs(ann.y2 - ann.y1);
        document.getElementById('propCenter').textContent = `(${cx}, ${cy})`;
        document.getElementById('propSize').textContent = `${w} × ${h}`;
    } else {
        panel.style.display = 'none';
    }
});

document.addEventListener('annotation:deselected', () => {
    document.getElementById('propertyPanel').style.display = 'none';
});

// 属性面板：修改类别
document.getElementById('propClass').addEventListener('change', (e) => {
    const ann = AppState.currentAnnotation;
    if (!ann) return;
    const newClassId = parseInt(e.target.value);
    const oldClassId = ann.class_id;
    if (newClassId === oldClassId) return;
    ann.class_id = newClassId;
    UndoStack.push({
        type: 'changeClass',
        annotationId: ann.id,
        from_class_id: oldClassId,
        to_class_id: newClassId,
    });
    saveCurrentAnnotations();
    Canvas.render();
    // 同步顶部类别下拉框
    document.getElementById('classSelector').value = newClassId;
});

// 属性面板：删除按钮
document.getElementById('btnDeleteAnnotation').addEventListener('click', () => {
    const idx = AppState.currentAnnotations.findIndex(
        a => a.id === AppState.selectedAnnotationId);
    if (idx === -1) return;
    const ann = AppState.currentAnnotations[idx];
    UndoStack.push({ type: 'delete', annotation: ann, index: idx });
    AppState.currentAnnotations.splice(idx, 1);
    AppState.selectedAnnotationId = null;
    saveCurrentAnnotations();
    document.dispatchEvent(new CustomEvent('annotation:deselected'));
    Canvas.render();
    updateStatusBar();
});

// 点击画布空白取消选中（已在 canvas.js 中处理）
```

- [ ] **Step 3: 测试完整的编辑流程**

选中框 → 拖拽移动 → 属性面板修改类别 → Delete 删除 → Ctrl+Z 撤销全部

- [ ] **Step 4: Commit**

```bash
git add static/js/canvas.js static/js/app.js
git commit -m "feat: add property panel with class change and delete, selection highlight"
```

---

### Phase 2 验收检查清单

- [ ] 四种形状绘制正确，保存的 TXT 归一化值正确
- [ ] Shift 绘制中切换正方形↔矩形、圆形↔椭圆
- [ ] 点击选中标注框，高亮显示
- [ ] 选中后可拖拽移动
- [ ] 点击空白取消选中
- [ ] 重叠框循环选中（再次点击同一位置切换）
- [ ] Delete 删除，Ctrl+Z 撤销，Ctrl+Y 重做
- [ ] 属性面板显示/修改类别
- [ ] 切换到另一图片 undo 栈清空

---

## Phase 3：交互体验完善

### Task 3.1: 双击自适应窗口 + 缩放比例显示

**Files:**
- Modify: `static/js/canvas.js` — 已完成（Phase 1 已实现 `zoomToFit` 和 `_updateZoomDisplay`）

**验证**：
- [ ] `双击空白` → 图片缩放到刚好适合当前视口
- [ ] `0` → 恢复 100%
- [ ] 右下角和底部状态栏显示当前缩放比例

无需新增代码，Phase 1 已实现。如发现 bug 则修复。

### Task 3.2: 图片列表滚动加载

**Files:**
- Modify: `static/js/sidebar.js`

- [ ] **Step 1: 图片数量大时优化缩略图加载**

缩略图使用 `loading="lazy"` 已实现。额外优化：只有滚动到可视区域附近才加载缩略图。

```javascript
// 在 sidebar.js 的 render() 中，使用 IntersectionObserver
// 注：由于当前已使用 loading="lazy"，此步骤为可选优化
// 500 张图片以下无需额外优化
```

如果项目图片超过 500 张，可在 `render()` 中实现虚拟滚动。当前设计假设每项目不超过 500 张，无需此优化。

- [ ] **Step 2: 验证筛选功能**

筛选 [全部] [已标注] [未标注] 正常工作。

- [ ] **Step 3: Commit**

（如无代码变更，与后续任务合并提交）

### Task 3.3: 进度追踪完善

**Files:**
- Modify: `static/js/app.js` — 状态栏更新逻辑

- [ ] **Step 1: 完善 updateStatusBar()**

```javascript
function updateStatusBar() {
    document.getElementById('statusImageIndex').textContent =
        `${AppState.currentIndex + 1}/${AppState.images.length}`;
    document.getElementById('statusAnnotationCount').textContent =
        `标注: ${AppState.currentAnnotations.length}`;
}
```

此函数已在 Phase 1 的 app.js 和 toolbar.js 中调用。确认每次操作后状态栏实时更新。

- [ ] **Step 2: 验证切图自动保存**

A/D 键切图 → 检查 labels/ 目录文件已更新 → 切回原图 → 标注仍然存在。

已完成（`loadImage` 在切换前调用 `saveCurrentAnnotations`）。

---

### Task 3.5: 系统托盘

**Files:**
- Modify: `src-tauri/src/lib.rs` — 添加托盘初始化代码

- [ ] **Step 1: 在 lib.rs run() 中添加系统托盘**

```rust
use tauri::tray::{TrayIconBuilder, MenuEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};

// 在 .setup() 闭包中，窗口创建之后添加:

// 构建托盘菜单
let tray_menu = MenuBuilder::new(app)
    .item(&MenuItemBuilder::with_id("open", "打开窗口").build(app)?)
    .separator()
    .item(&MenuItemBuilder::with_id("quit", "退出").build(app)?)
    .build()?;

let _tray = TrayIconBuilder::new()
    .menu(&tray_menu)
    .tooltip("YOLO Game UI Labeler")
    .on_menu_event(|app, event| match event.id().as_ref() {
        "open" => {
            if let Some(window) = app.get_webview_window("main") {
                window.show().ok();
                window.set_focus().ok();
            }
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    })
    .build(app)?;
```

**说明**：关闭窗口时不应退出应用，而是隐藏到托盘。需要修改窗口关闭行为：

```rust
// 在 .on_window_event 中修改 Destroyed → CloseRequested
.on_window_event(|window, event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        // 隐藏窗口而非退出（托盘模式）
        window.hide().ok();
        api.prevent_close();
    }
})
```

Phase 4 打包时再启用托盘——开发阶段关闭窗口直接退出更方便调试。

- [ ] **Step 2: Commit**

### Phase 3 验收检查清单

- [ ] 双击空白自适应窗口
- [ ] 0 键重置 100%
- [ ] 缩放比例实时显示
- [ ] 图片列表筛选正常
- [ ] 切图自动保存
- [ ] 状态栏实时更新
- [ ] 系统托盘图标显示，右键菜单工作

---

## Phase 4：收尾与测试

### Task 4.1: 形状元数据存储 (.meta/) — 验证

**状态**: 代码已在 Phase 1 实现（Task 1.2 `ensure_project_dir` 已包含 `.meta/` 目录，Task 1.4 `save_annotations` 已写入 `.meta/`）。此任务仅验证。

- [ ] **Step 1: 验证 .meta 目录和文件生成**

创建项目，画几个不同形状的标注框，检查 `.meta/screenshot_001.meta.json` 内容是否正确：

```json
[
  {"class_id": 0, "shape": "circle"},
  {"class_id": 1, "shape": "rect"}
]
```

- [ ] **Step 2: 验证空标注时清理 .meta 文件**

删除图片上所有标注框后保存，确认 `.meta/` 下对应文件被删除。

- [ ] **Step 3: 发现 bug 则修复，无变更则与后续任务合并提交**

### Task 4.2: 图片详情 API 恢复形状信息

**Files:**
- Modify: `labeler/views.py` — `image_detail` 视图

- [ ] **Step 1: 修改 image_detail 读取 .meta 文件**

```python
def image_detail(request, project_id, image_name):
    # ... 现有代码（读取图片尺寸和 TXT 标注） ...

    # 读取形状元数据
    meta_path = project_dir / '.meta' / f"{Path(image_name).stem}.meta.json"
    meta_list = []
    if meta_path.exists():
        try:
            with open(meta_path, 'r', encoding='utf-8') as f:
                meta_list = json.load(f)
        except (json.JSONDecodeError, IOError):
            meta_list = []  # 文件损坏时回退

    # 合并标注和元数据
    # 数量不匹配时：TXT 比 meta 多 → 多余标注回退为 rect；meta 比 TXT 多 → 忽略多余 meta
    meta_mismatch = len(meta_list) != len(raw_annotations)
    annotations = []
    for i, ann in enumerate(raw_annotations):
        meta = meta_list[i] if i < len(meta_list) else {}
        shape = meta.get('shape', 'rect') if not meta_mismatch else 'rect'
        x1, y1, x2, y2 = utils.yolo_to_pixel(
            ann['cx'], ann['cy'], ann['w'], ann['h'], img_w, img_h)
        annotations.append({
            'id': '',  # 前端分配新 ID
            'class_id': ann['class_id'],
            'shape': shape,
            'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
            '_meta_mismatch': meta_mismatch,  # 前端据此显示警告
        })

    # ... 返回响应 ...
```

- [ ] **Step 2: 验证断点续标时形状信息恢复**

打开已有标注的项目 → 确认之前画的圆形显示为圆形（而非全部还原为矩形）。

- [ ] **Step 3: Commit**

```bash
git add labeler/views.py
git commit -m "fix: restore shape info from .meta/ when loading existing annotations"
```

### Task 4.3: Python 运行时嵌入 + 首次启动引导

- [ ] **Step 1: 下载 Python embeddable 包**

```bash
# 从 python.org 下载 Windows embeddable package
# 示例: python-3.12.4-embed-amd64.zip (~9 MB)
# 解压到: yolo_game_ui_labeler/runtime/python/

# 修改 python312._pth 文件，取消 import site 的注释以启用 pip
```

- [ ] **Step 2: 创建首次启动引导脚本**

```python
# bootstrap.py — 首次启动时自动安装依赖
import subprocess
import sys
import os

RUNTIME_DIR = os.path.dirname(os.path.abspath(__file__))
REQUIREMENTS = os.path.join(os.path.dirname(RUNTIME_DIR), 'requirements.txt')

def bootstrap():
    # 安装 pip
    subprocess.check_call([sys.executable, '-m', 'ensurepip', '--upgrade'])
    # 安装项目依赖
    subprocess.check_call([
        sys.executable, '-m', 'pip', 'install',
        '-r', REQUIREMENTS,
        '--quiet', '--no-warn-script-location',
    ])

if __name__ == '__main__':
    bootstrap()
```

- [ ] **Step 3: 更新 main.rs 中 Python 路径**

将 Task 0.4 中硬编码的 `"python"` 改为相对路径指向嵌入运行时：

```rust
fn get_python_path() -> PathBuf {
    // 开发环境：使用系统 Python
    // 生产环境：使用嵌入的 runtime/python/python.exe
    let exe_dir = std::env::current_exe()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();

    let embedded = exe_dir.join("runtime/python/python.exe");
    if embedded.exists() {
        return embedded;
    }

    // Fallback: 开发时用系统 PATH 中的 python
    PathBuf::from("python")
}

fn ensure_dependencies(python: &Path) -> Result<(), String> {
    // 检查 Django 是否已安装
    let output = Command::new(python)
        .args(["-c", "import django; print(django.VERSION)"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        // 首次启动：运行 bootstrap.py
        let bootstrap = python.parent().unwrap().join("bootstrap.py");
        if bootstrap.exists() {
            Command::new(python)
                .arg(&bootstrap)
                .status()
                .map_err(|e| format!("依赖安装失败: {}", e))?;
        } else {
            return Err("Python 依赖未安装且找不到 bootstrap.py".into());
        }
    }
    Ok(())
}
```

- [ ] **Step 4: 更新 start_django 函数**

在 `start_django()` 中使用 `get_python_path()` 和 `ensure_dependencies()`：

```rust
fn start_django() -> Option<(Child, u16)> {
    let python = get_python_path();
    ensure_dependencies(&python).ok()?;  // 首次启动自动安装依赖

    let port = portpicker::pick_unused_port().unwrap_or(8000);
    let addr = format!("127.0.0.1:{}", port);

    let child = Command::new(&python)
        .args(["manage.py", "runserver", &addr, "--noreload"])
        .current_dir(
            std::env::current_exe().unwrap().parent().unwrap()
        )
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .ok()?;
    // ... 健康检查循环保持不变
}
```

- [ ] **Step 5: tauri.conf.json 打包配置**

```json
{
  "bundle": {
    "active": true,
    "targets": "msi",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/icon.ico"
    ],
    "resources": [
      "../runtime/**",
      "../manage.py",
      "../labeler/**",
      "../templates/**",
      "../static/**",
      "../requirements.txt"
    ],
    "windows": {
      "wix": {
        "language": "zh-CN"
      }
    }
  }
}
```

### Task 4.4: 项目管理完善

**Files:**
- Modify: `static/js/app.js` — 断点续标（记住上次标注位置）

- [ ] **Step 1: 在项目注册表中记录上次标注图片索引**

在 `project_detail` GET 视图中添加：

```python
info['last_image_index'] = info.get('last_image_index', 0)
```

- [ ] **Step 2: 前端打开项目时跳转到上次位置**

在 `app.js` 的 `loadProject` 中：

```javascript
    const startIndex = data.last_image_index || 0;
    if (AppState.images.length > 0) {
        await loadImage(Math.min(startIndex, AppState.images.length - 1));
    }
```

- [ ] **Step 3: 保存上次位置**

在 `loadImage` 中更新项目元数据（通过 API 记录当前索引）。可在 `saveCurrentAnnotations` 成功后顺便更新。

- [ ] **Step 4: Commit**

（合并到后续任务提交）

### Task 4.4: 错误处理与边界情况

**Files:**
- Modify: `static/js/app.js` — 图片加载失败处理
- Modify: `labeler/views.py` — 各类边界校验

- [ ] **Step 1: 前端错误处理**

```javascript
// loadImage 中图片加载失败:
    img.onerror = () => {
        showStatusError('图片加载失败: ' + fileName);
    };

// saveCurrentAnnotations 失败提示（不丢失数据）:
    } catch (err) {
        showStatusError('保存失败: ' + err.message);
    }
```

- [ ] **Step 2: 后端边界检查确认**

确认以下边界情况均已处理：
- [ ] 项目名称非法字符（正则校验）
- [ ] 图片目录不存在/为空（创建时校验）
- [ ] 最小标注 3px（canvas.js）
- [ ] TXT 空标注删除文件（utils.py `write_txt_annotations`）
- [ ] 类别配置格式错误（弹窗提示，回退默认）

- [ ] **Step 3: Commit**

```bash
git add static/js/app.js labeler/views.py
git commit -m "fix: complete error handling for all edge cases"
```

### Task 4.5: API 端点 — 类别配置读写

**Files:**
- Modify: `labeler/views.py` — 追加 `project_classes` 视图

- [ ] **Step 1: 在 views.py 末尾追加**

```python
@csrf_exempt
def project_classes(request, project_id):
    """GET: 获取类别配置 / PUT: 更新类别配置"""
    registry = utils.load_project_registry()
    if project_id not in registry:
        return _json_response({'error': '项目不存在'}, status=404)

    project_dir = utils.PROJECTS_ROOT / project_id
    classes_path = project_dir / 'classes.json'

    if request.method == 'GET':
        if classes_path.exists():
            with open(classes_path, 'r', encoding='utf-8') as f:
                return _json_response(json.load(f))
        return _json_response({'classes': []})

    elif request.method == 'PUT':
        body = _parse_body(request)
        with open(classes_path, 'w', encoding='utf-8') as f:
            json.dump(body, f, indent=2, ensure_ascii=False)
        # 通知前端重新加载类别
        return _json_response({'success': True})

    return _json_response({'error': 'Method not allowed'}, status=405)
```

- [ ] **Step 2: Commit**

```bash
git add labeler/views.py
git commit -m "feat: add classes config read/update API"
```

### Task 4.6: 整体测试

- [ ] **Step 1: 端到端测试流程**

1. 准备 10 张测试图片，创建 `test_classes.json`
2. 启动服务器，创建项目
3. 逐张标注（使用全部 4 种形状）
4. 测试编辑操作（移动、删除、改类别、撤销/重做）
5. 测试快捷键全覆盖
6. 关闭浏览器，重新打开项目
7. 验证断点续标（标注数据完整恢复，形状信息保留）
8. 删除项目，确认清理干净

- [ ] **Step 2: 性能验证**

- 500 张图片项目：图片列表加载 < 3 秒
- Canvas 标注操作：帧率 ≥ 30fps（肉眼无延迟）
- TXT 保存：点击后 < 100ms 完成

- [ ] **Step 3: 修复发现的问题并提交**

---

### Phase 4 验收检查清单

- [ ] 端到端测试：创建项目 → 标注全部 4 种形状 → 编辑/删除/撤销 → 断点续标验证
- [ ] labels/*.txt 文件可直接用于 YOLO 训练
- [ ] 能创建、切换、删除项目
- [ ] 重新打开项目能恢复标注状态（含形状信息）
- [ ] 所有边界情况有合理处理
- [ ] 500 张图片项目操作流畅无卡顿

---

## 依赖安装与启动命令速查

### 首次安装

```bash
# 1. Python 环境
cd "D:\YOLO Game UI Labeler"
python -m venv venv
venv\Scripts\activate   # macOS: source venv/bin/activate
pip install -r requirements.txt

# 2. Rust 工具链（如果尚未安装）
# Windows: winget install Rustlang.Rustup
# macOS: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 3. Tauri CLI
cargo install tauri-cli --version "^2"
```

### 开发模式启动

```bash
# 方式一：Tauri 桌面开发（推荐）
# 自动启动 Django + 打开桌面窗口
cargo tauri dev

# 方式二：纯 Web 开发（调试前端用）
# Terminal 1: Django
python manage.py runserver 127.0.0.1:8000
# Terminal 2: 浏览器访问 http://127.0.0.1:8000/
```

### 生产打包

```bash
# 生成可分发的安装包
cargo tauri build

# 输出:
#   Windows: src-tauri/target/release/bundle/msi/yolo-game-ui-labeler_1.0.0_x64.msi
#   macOS:   src-tauri/target/release/bundle/dmg/YOLO Game UI Labeler_1.0.0_x64.dmg
```

### 访问路径

- 桌面应用：双击桌面图标或安装目录中的可执行文件
- 开发模式浏览器访问：
  - 项目选择页: `http://127.0.0.1:8000/`
  - 标注界面: `http://127.0.0.1:8000/annotate/<project_id>/`
