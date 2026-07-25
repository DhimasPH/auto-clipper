#!/bin/bash
echo "Building backend..."
pyinstaller backend.spec -y

if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

echo "Copying executable..."
cp -f dist/backend.exe bin/backend-x86_64-pc-windows-msvc.exe
cp -f dist/backend.exe bin/backend.exe

echo "Build and copy completed successfully!"
