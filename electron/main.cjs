const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
let pythonProcess;
let backendKilled = false;
let isJobActive = false;

ipcMain.on("set-job-active", (event, active) => {
  isJobActive = active;
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
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Start Python Backend
  pythonProcess = spawn("python", ["-m", "backend.main"]);

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

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

app.whenReady().then(createWindow);

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
