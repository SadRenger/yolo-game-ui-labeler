use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

struct DjangoProcess(Mutex<Option<Child>>);

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
    let port = portpicker::pick_unused_port().unwrap_or(8000);
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
async fn pick_image_directory(app: tauri::AppHandle) -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_title("选择图片目录")
        .pick_folder(move |path| {
            let _ = tx.send(path);
        });
    match rx.recv() {
        Ok(Some(path)) => Ok(path.to_string()),
        _ => Ok(String::new()),
    }
}

#[tauri::command]
async fn pick_json_file(app: tauri::AppHandle) -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_title("选择类别配置文件")
        .add_filter("JSON 文件", &["json"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });
    match rx.recv() {
        Ok(Some(path)) => Ok(path.to_string()),
        _ => Ok(String::new()),
    }
}

pub fn run() {
    let (django_child, port) = start_django()
        .expect("Failed to start Django server");

    let django = DjangoProcess(Mutex::new(Some(django_child)));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(django)
        .invoke_handler(tauri::generate_handler![pick_image_directory, pick_json_file])
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

            let window = app.get_webview_window("main").unwrap();

            // devUrl 模式下不重定向
            if cfg!(dev) {
                // 开发模式 — devUrl 已指向正确的地址
            } else {
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
