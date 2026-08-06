!macro NSIS_HOOK_PREINSTALL
  ; Mematikan paksa aplikasi dan backend jika sedang berjalan di background
  ExecWait "taskkill /IM backend.exe /F /T"
  ExecWait "taskkill /IM backend-x86_64-pc-windows-msvc.exe /F /T"
  ExecWait 'taskkill /IM "Auto Clipper.exe" /F /T'
  ExecWait "taskkill /IM app.exe /F /T"
!macroend

