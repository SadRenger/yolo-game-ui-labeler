use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

struct DjangoProcess(Mutex<Option<Child>>);
static DJANGO_PORT: u16 = 8000;

fn exe_dir() -> std::path::PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_default()
}

fn find_python() -> std::path::PathBuf {
    let base = exe_dir();
    // 1. 优先：runtime/ 内嵌 Python（与 exe 同目录）
    let embedded = base.join("runtime/python.exe");
    if embedded.exists() {
        return embedded;
    }
    // 2. 开发环境：venv Python（相对 CWD）
    let venv_python = std::path::PathBuf::from("venv/Scripts/python.exe");
    if venv_python.exists() {
        return venv_python;
    }
    // 3. Fallback: 系统 PATH 中的 python
    std::path::PathBuf::from("python")
}

fn start_django() -> Option<(Child, u16)> {
    let port: u16 = DJANGO_PORT;
    let addr = format!("127.0.0.1:{}", port);

    let python = find_python();

    // manage.py 在 exe 同目录的 runtime/ 下
    let manage_py = if exe_dir().join("runtime/python.exe").exists() {
        exe_dir().join("runtime/manage.py")
    } else {
        std::path::PathBuf::from("manage.py")
    };
    let manage_py_str = manage_py.to_str().unwrap_or("manage.py");

    let mut cmd = Command::new(&python);
    cmd.args([manage_py_str, "runserver", &addr, "--noreload"]);
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());
    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let child = cmd.spawn().ok()?;

    let pid = child.id();

    // 等待 Django 就绪（最多 10 秒）
    let start = std::time::Instant::now();
    loop {
        if start.elapsed().as_secs() > 10 {
            // 超时——终止进程
            #[cfg(windows)]
            {
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/PID", &pid.to_string()]).spawn();
            }
            #[cfg(not(windows))]
            {
                let _ = std::process::Command::new("kill").arg(pid.to_string()).spawn();
            }
            return None;
        }
        if reqwest::blocking::get(format!("http://{}", addr)).is_ok() {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(300));
    }

    Some((child, port))
}

#[tauri::command]
fn pick_image_directory() -> Result<String, String> {
    let path = rfd::FileDialog::new()
        .set_title("选择图片目录")
        .pick_folder();
    Ok(path.map(|p| p.to_string_lossy().to_string()).unwrap_or_default())
}

#[tauri::command]
fn pick_json_file() -> Result<String, String> {
    let path = rfd::FileDialog::new()
        .set_title("选择类别配置文件")
        .add_filter("JSON 文件", &["json"])
        .pick_file();
    Ok(path.map(|p| p.to_string_lossy().to_string()).unwrap_or_default())
}

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

#[tauri::command]
fn fetch_image_blob(path: String) -> Result<String, String> {
    let url = format!("http://127.0.0.1:{}{}", DJANGO_PORT, path);
    let response = reqwest::blocking::get(&url)
        .map_err(|e| format!("图片请求失败: {}", e))?;
    let status = response.status();
    let content_type = response.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_string();
    let bytes = response.bytes()
        .map_err(|e| format!("读取图片失败: {}", e))?;
    if !status.is_success() {
        // Django 返回了错误响应（如图片不存在）
        let body = String::from_utf8_lossy(&bytes);
        return Err(format!("Django {} ({}/{}): {}",
            status.as_u16(), url, content_type,
            if body.len() > 200 { &body[..200] } else { &body }));
    }
    Ok(base64_encode(&bytes))
}

fn base64_encode(bytes: &[u8]) -> String {
    // 简单 base64 编码 (无外部依赖)
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

#[tauri::command]
fn api_request(method: String, path: String, body: Option<String>) -> Result<String, String> {
    let url = format!("http://127.0.0.1:{}{}", DJANGO_PORT, path);
    let client = reqwest::blocking::Client::new();
    let mut builder = match method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url).header("Content-Type", "application/json"),
        "PUT" => client.put(&url).header("Content-Type", "application/json"),
        "DELETE" => client.delete(&url),
        _ => return Err(format!("Unsupported method: {}", method)),
    };
    if let Some(ref b) = body {
        builder = builder.body(b.clone());
    }
    let response = builder.send().map_err(|e| format!("Django 连接失败: {}", e))?;
    let status = response.status();
    let text = response.text().map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        let preview: String = text.chars().take(200).collect();
        return Err(format!("Django {} ({} {}): {}",
            status.as_u16(), method, path, preview));
    }
    Ok(text)
}

pub fn run() {
    let (django_child, _port) = start_django()
        .expect("Failed to start Django server");

    let django = DjangoProcess(Mutex::new(Some(django_child)));

    tauri::Builder::default()
        .manage(django)
        .invoke_handler(tauri::generate_handler![pick_image_directory, pick_json_file, api_request, ping, fetch_image_blob])
        .setup(move |app| {
            // 单实例锁：尝试绑定固定本地端口
            use std::net::TcpListener;
            let lock_addr = "127.0.0.1:17839";
            let lock = match TcpListener::bind(lock_addr) {
                Ok(l) => l,
                Err(_) => {
                    std::process::exit(0);
                }
            };
            std::mem::forget(lock);

            // 页面由 frontendDist (static/) 本地 serve
            // Django 作为纯 API 后端运行在 127.0.0.1:{port}
            // 前端通过 API.base 自动检测并跨域访问 Django
            let _window = app.get_webview_window("main").unwrap();
            // 注意: 不使用 window.navigate() —— 否则页面离开本地域后 Tauri IPC 会丢失

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
