Write-Host "Building backend..."
pyinstaller backend.spec -y

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Copying executable..."
Copy-Item dist\backend.exe bin\backend-x86_64-pc-windows-msvc.exe -Force
Copy-Item dist\backend.exe bin\backend.exe -Force

Write-Host "Build and copy completed successfully!" -ForegroundColor Green
