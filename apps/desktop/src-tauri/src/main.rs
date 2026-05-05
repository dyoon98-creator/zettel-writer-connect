// main.rs — AI 원고실 Tauri 2 진입점.
// Phase F: AI 호출 + 설정 영속화 명령 추가.
// Phase H: macOS 시스템 메뉴바 한글화.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai_bridge;
mod commands;
mod error;
mod watcher;

use std::sync::Arc;

use tauri::menu::{
    AboutMetadataBuilder, MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder,
};
use tauri::Emitter;
use tauri_plugin_deep_link::DeepLinkExt;

use ai_bridge::AiInvocationRegistry;
use commands::{
    ai_cancel, ai_find_binary, ai_invoke, ai_resolve_binary, deep_link::emit_deep_link,
    settings_load, settings_save, vault_copy_file, vault_delete_file, vault_ensure_dir,
    vault_exists, vault_list_dir, vault_read_file, vault_watch_start, vault_watch_stop,
    vault_write_file, voice_delete_file, voice_folder_info, voice_list_files, voice_open_folder,
    voice_path, voice_read_file, voice_reset_folder, voice_set_folder, voice_write_file,
};
use watcher::WatcherRegistry;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(WatcherRegistry::new())
        .manage(Arc::new(AiInvocationRegistry::new()))
        .invoke_handler(tauri::generate_handler![
            vault_read_file,
            vault_write_file,
            vault_copy_file,
            vault_exists,
            vault_list_dir,
            vault_ensure_dir,
            vault_delete_file,
            vault_watch_start,
            vault_watch_stop,
            ai_invoke,
            ai_cancel,
            ai_resolve_binary,
            ai_find_binary,
            settings_load,
            settings_save,
            voice_path,
            voice_folder_info,
            voice_set_folder,
            voice_reset_folder,
            voice_list_files,
            voice_read_file,
            voice_write_file,
            voice_delete_file,
            voice_open_folder,
        ])
        .setup(|app| {
            // 0) macOS 시스템 메뉴바를 한글로 새로 빌드.
            let handle = app.handle().clone();

            let about_meta = AboutMetadataBuilder::new()
                .name(Some("AI 원고실"))
                .version(Some(env!("CARGO_PKG_VERSION").to_string()))
                .copyright(Some("© futurewave"))
                .build();

            // PredefinedMenuItem들을 미리 빌드.
            let about_item = PredefinedMenuItem::about(&handle, Some("AI 원고실에 대하여"), Some(about_meta))?;
            let services_item = PredefinedMenuItem::services(&handle, Some("서비스"))?;
            let hide_item = PredefinedMenuItem::hide(&handle, Some("AI 원고실 가리기"))?;
            let hide_others_item = PredefinedMenuItem::hide_others(&handle, Some("다른 앱 가리기"))?;
            let show_all_item = PredefinedMenuItem::show_all(&handle, Some("모두 보기"))?;
            let quit_item = PredefinedMenuItem::quit(&handle, Some("AI 원고실 종료"))?;

            let undo_item = PredefinedMenuItem::undo(&handle, Some("실행 취소"))?;
            let redo_item = PredefinedMenuItem::redo(&handle, Some("다시 실행"))?;
            let cut_item = PredefinedMenuItem::cut(&handle, Some("잘라내기"))?;
            let copy_item = PredefinedMenuItem::copy(&handle, Some("복사"))?;
            let paste_item = PredefinedMenuItem::paste(&handle, Some("붙여넣기"))?;
            let select_all_item = PredefinedMenuItem::select_all(&handle, Some("모두 선택"))?;

            let close_window_item = PredefinedMenuItem::close_window(&handle, Some("창 닫기"))?;
            let minimize_item = PredefinedMenuItem::minimize(&handle, Some("최소화"))?;
            let maximize_item = PredefinedMenuItem::maximize(&handle, Some("최대화"))?;
            let fullscreen_item = PredefinedMenuItem::fullscreen(&handle, Some("전체 화면"))?;
            let separator = || PredefinedMenuItem::separator(&handle);

            // Custom 명령 항목들.
            let prefs_item = MenuItem::with_id(&handle, "preferences", "환경설정...", true, Some("CmdOrCtrl+,"))?;
            let new_manuscript_item = MenuItem::with_id(&handle, "new-manuscript", "새 원고 만들기", true, Some("CmdOrCtrl+Shift+N"))?;
            let new_scene_item = MenuItem::with_id(&handle, "new-scene", "새 장면", true, Some("CmdOrCtrl+N"))?;
            let new_folder_item = MenuItem::with_id(&handle, "new-folder", "새 폴더", true, Some("CmdOrCtrl+Alt+N"))?;
            let save_item = MenuItem::with_id(&handle, "save", "저장", true, Some("CmdOrCtrl+S"))?;
            let focus_binder_item = MenuItem::with_id(&handle, "focus-binder", "바인더 포커스", true, Some("CmdOrCtrl+1"))?;
            let focus_editor_item = MenuItem::with_id(&handle, "focus-editor", "에디터 포커스", true, Some("CmdOrCtrl+2"))?;
            let focus_inspector_item = MenuItem::with_id(&handle, "focus-inspector", "인스펙터 포커스", true, Some("CmdOrCtrl+3"))?;
            let toggle_corkboard_item = MenuItem::with_id(&handle, "toggle-corkboard", "코크보드 전환", true, Some("CmdOrCtrl+K"))?;
            let user_guide_item = MenuItem::with_id(&handle, "open-user-guide", "사용자 가이드", true, None::<&str>)?;

            let app_submenu = SubmenuBuilder::new(&handle, "AI 원고실")
                .item(&about_item)
                .item(&separator()?)
                .item(&prefs_item)
                .item(&separator()?)
                .item(&services_item)
                .item(&separator()?)
                .item(&hide_item)
                .item(&hide_others_item)
                .item(&show_all_item)
                .item(&separator()?)
                .item(&quit_item)
                .build()?;

            let file_submenu = SubmenuBuilder::new(&handle, "파일")
                .item(&new_manuscript_item)
                .item(&new_scene_item)
                .item(&new_folder_item)
                .item(&separator()?)
                .item(&save_item)
                .item(&close_window_item)
                .build()?;

            let edit_submenu = SubmenuBuilder::new(&handle, "편집")
                .item(&undo_item)
                .item(&redo_item)
                .item(&separator()?)
                .item(&cut_item)
                .item(&copy_item)
                .item(&paste_item)
                .item(&select_all_item)
                .build()?;

            let view_submenu = SubmenuBuilder::new(&handle, "보기")
                .item(&focus_binder_item)
                .item(&focus_editor_item)
                .item(&focus_inspector_item)
                .item(&separator()?)
                .item(&toggle_corkboard_item)
                .item(&separator()?)
                .item(&fullscreen_item)
                .build()?;

            let window_submenu = SubmenuBuilder::new(&handle, "윈도우")
                .item(&minimize_item)
                .item(&maximize_item)
                .item(&separator()?)
                .item(&close_window_item)
                .build()?;

            let help_submenu = SubmenuBuilder::new(&handle, "도움말")
                .item(&user_guide_item)
                .build()?;

            let menu = MenuBuilder::new(&handle)
                .item(&app_submenu)
                .item(&file_submenu)
                .item(&edit_submenu)
                .item(&view_submenu)
                .item(&window_submenu)
                .item(&help_submenu)
                .build()?;

            app.set_menu(menu)?;

            // 메뉴 클릭 → frontend 이벤트로 전달.
            let app_for_menu = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                let id = event.id().0.as_str().to_string();
                let _ = app_for_menu.emit("menu:click", id);
            });

            // 1) cold-launch 시점에 OS가 우리에게 넘긴 URL을 즉시 처리.
            let app_handle = app.handle().clone();
            if let Ok(urls) = app.deep_link().get_current() {
                if let Some(urls) = urls {
                    for url in urls {
                        emit_deep_link(&app_handle, url.to_string());
                    }
                }
            }

            // 2) 이미 실행 중일 때 추가로 도착하는 URL을 받는 핸들러.
            let app_for_handler = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    emit_deep_link(&app_for_handler, url.to_string());
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("AI 원고실 실행 실패");
}
