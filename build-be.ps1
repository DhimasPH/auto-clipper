Write-Host "Building backend..."
pyinstaller --clean backend.spec -y

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Copying executable..."
Copy-Item -Force dist\backend.exe bin\backend-x86_64-pc-windows-msvc.exe
Copy-Item -Force dist\backend.exe bin\backend.exe

if (!(Test-Path -Path "src-tauri\bin")) {
    New-Item -ItemType Directory -Path "src-tauri\bin" | Out-Null
}
Copy-Item -Force dist\backend.exe src-tauri\bin\backend-x86_64-pc-windows-msvc.exe
Copy-Item -Force dist\backend.exe src-tauri\bin\backend.exe

Write-Host "Build and copy completed successfully!" -ForegroundColor Green
