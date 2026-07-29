@echo off
echo Building backend...
pyinstaller --clean backend.spec -y
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b %errorlevel%
)

echo Copying executable...
copy /Y dist\backend.exe bin\backend-x86_64-pc-windows-msvc.exe
copy /Y dist\backend.exe bin\backend.exe

echo Build and copy completed successfully!
pause
