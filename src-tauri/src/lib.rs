use std::process::{Child, Command};
use std::sync::Mutex;
use serde_json::Value;
use tauri::Manager;

struct DjangoProcess(Mutex<Option<Child>>);
static DJANGO_PORT: u16 = 8000;

fn find_python() -> std::path::PathBuf {
    // 优先使用项目目录下的 venv Python
    let venv_python = std::path::PathBuf::from("venv/Scripts/python.exe");
    if venv_python.exists() {
        return venv_python;
    }
    // Fallback: 系统 PATH 中的 python
    std::path::PathBuf::from("python")
}

fn start_django() -> Option<(Child, u16)> {
    let port: u16 = DJANGO_PORT;
    let addr = format!("127.0.0.1:{}", port);

    let python = find_python();

    let child = Command::new(&python)
        .args(["manage.py", "runserver", &addr, "--noreload"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .ok()?;

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
fn api_request(method: String, path: String, body: Option<String>) -> Result<Value, String> {
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
    let response = builder.send().map_err(|e| e.to_string())?;
    let text = response.text().map_err(|e| e.to_string())?;
    let json: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    Ok(json)
}

pub fn run() {
    let (django_child, _port) = start_django()
        .expect("Failed to start Django server");

    let django = DjangoProcess(Mutex::new(Some(django_child)));

    tauri::Builder::default()
        .manage(django)
        .invoke_handler(tauri::generate_handler![pick_image_directory, pick_json_file, api_request])
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
