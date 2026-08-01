use std::sync::Mutex;
use tauri::State;

struct AppState {
    keep_awake: Mutex<Option<keepawake::KeepAwake>>,
}

#[tauri::command]
fn prevent_sleep(state: State<'_, AppState>) -> Result<(), String> {
    let mut keep_awake = state.keep_awake.lock().unwrap();
    if keep_awake.is_none() {
        let mut builder = keepawake::Builder::default();
        builder.display(false)
            .idle(true)
            .sleep(true)
            .app_name("Auto Clipper")
            .reason("Video generation in progress");
            
        match builder.create() {
            Ok(k) => {
                *keep_awake = Some(k);
                log::info!("Device sleep prevented");
                Ok(())
            },
            Err(e) => {
                log::error!("Failed to prevent sleep: {}", e);
                Err(e.to_string())
            }
        }
    } else {
        Ok(())
    }
}

#[tauri::command]
fn allow_sleep(state: State<'_, AppState>) -> Result<(), String> {
    let mut keep_awake = state.keep_awake.lock().unwrap();
    *keep_awake = None;
    log::info!("Device sleep allowed");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(AppState {
        keep_awake: Mutex::new(None),
    })
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_stronghold::Builder::new(|password| {
      use sha2::{Sha256, Digest};
      let mut hasher = Sha256::new();
      hasher.update(password);
      hasher.update(b"auto-clipper-salt");
      let result = hasher.finalize();
      let mut key = [0u8; 32];
      key.copy_from_slice(&result);
      key.to_vec()
    }).build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![prevent_sleep, allow_sleep])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
