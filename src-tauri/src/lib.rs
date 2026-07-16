use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

struct DjangoProcess(Mutex<Option<Child>>);

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
