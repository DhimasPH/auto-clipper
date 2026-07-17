#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
