const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  setJobActive: (active) => ipcRenderer.send("set-job-active", active),
  getBackendPort: () => ipcRenderer.invoke("get-backend-port"),
  getApiKeys: () => ipcRenderer.invoke("get-api-keys"),
  saveApiKeys: (keys) => ipcRenderer.invoke("save-api-keys", keys),
});
