!macro NSIS_HOOK_PREINSTALL
  ; Mematikan paksa backend.exe jika sedang berjalan di background
  ExecWait "taskkill /IM backend.exe /F /T"
!macroend
