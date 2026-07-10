const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let mainWindow;
let pythonProcess;
let backendKilled = false;
let isJobActive = false;
let backendPort = null;

// Safe Storage Helper
function getSecretsPath() {
  return path.join(app.getPath("userData"), "secrets.enc");
}

ipcMain.on("set-job-active", (event, active) => {
  isJobActive = active;
});

ipcMain.handle("get-backend-port", () => {
  return backendPort;
});

ipcMain.handle("get-api-keys", () => {
  try {
    const p = getSecretsPath();
    if (fs.existsSync(p)) {
      const encrypted = fs.readFileSync(p);
      const decrypted = safeStorage.decryptString(encrypted);
      return JSON.parse(decrypted);
    }
  } catch (e) {
    console.error("Failed to read secrets", e);
  }
  return { geminiKey: "", openaiKey: "" };
});

ipcMain.handle("save-api-keys", (event, keys) => {
  try {
    const data = JSON.stringify(keys);
    const encrypted = safeStorage.encryptString(data);
    fs.writeFileSync(getSecretsPath(), encrypted);
    return true;
  } catch (e) {
    console.error("Failed to save secrets", e);
    return false;
  }
});

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"]
  });
  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.on("open-folder", (event, folderPath) => {
  shell.showItemInFolder(folderPath);
});

function killBackend() {
  if (backendKilled || !pythonProcess) return;
  backendKilled = true;
  const pid = pythonProcess.pid;
  try {
    if (process.platform === "win32") {
      // pythonProcess.kill() does NOT kill grandchildren on Windows, which
      // leaves a zombie backend holding port 8000. taskkill /T kills the tree.
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"]);
    } else {
      pythonProcess.kill("SIGTERM");
    }
  } catch (e) {
    // Best effort — nothing more we can do on shutdown.
  }
  pythonProcess = null;
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  // Mencegah hotkey reload (Ctrl+R, Cmd+R, F5)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.key === 'F5' ||
      (input.control && input.key.toLowerCase() === 'r') ||
      (input.meta && input.key.toLowerCase() === 'r')
    ) {
      event.preventDefault();
    }
  });

  // Start Python Backend
  if (app.isPackaged) {
    const backendExecutable = process.platform === "win32" ? "backend.exe" : "backend";
    const backendPath = path.join(process.resourcesPath, "bin", backendExecutable);
    pythonProcess = spawn(backendPath, []);
  } else {
    pythonProcess = spawn("python", ["-m", "backend.main"]);
  }
  
  // Tangkap stdout untuk port
  pythonProcess.stdout.on("data", (data) => {
    const text = data.toString();
    console.log("[FastAPI]", text.trim());
    const match = text.match(/AUTO_CLIPPER_BACKEND_PORT=(\d+)/);
    if (match && !backendPort) {
      backendPort = parseInt(match[1], 10);
      console.log(`Backend is running on dynamic port ${backendPort}`);
      
      // Load URL ONLY after port is discovered
      if (process.env.NODE_ENV === "development") {
        mainWindow.loadURL("http://localhost:5173");
      } else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
      }
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error("[FastAPI ERROR]", data.toString().trim());
  });

  // Navigation is handled inside the stdout listener after port is found.

  mainWindow.on("close", (e) => {
    if (isJobActive) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: "warning",
        buttons: ["Batal", "Tutup Aplikasi"],
        title: "Peringatan",
        message: "Ada proses pembuatan klip yang sedang berjalan.",
        detail:
          "Apakah Anda yakin ingin menutup aplikasi? Proses ini akan dibatalkan.",
      });
      if (choice === 0) {
        e.preventDefault(); // User clicked Batal
      }
    }
  });

  // Intercept downloads and force a Save As dialog
  mainWindow.webContents.session.on(
    "will-download",
    (event, item, webContents) => {
      item.setSaveDialogOptions({
        title: "Save Clip As",
        defaultPath: item.getFilename(),
        filters: [
          { name: "Video", extensions: ["mp4"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
    },
  );
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.autoclipper.app");
  createWindow();
});

// Kill the backend before the app actually exits, on every shutdown path.
app.on("before-quit", killBackend);
app.on("will-quit", killBackend);
process.on("exit", killBackend);

app.on("window-all-closed", () => {
  killBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
