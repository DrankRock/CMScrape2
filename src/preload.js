const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  selectOutputDir: () => ipcRenderer.invoke("select-output-dir"),
  loadFile: (type) => ipcRenderer.invoke("load-file", type),
  startScrape: (config) => ipcRenderer.invoke("start-scrape", config),
  stopScrape: () => ipcRenderer.invoke("stop-scrape"),
  loadConfig: () => ipcRenderer.invoke("load-config"),
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),
  onScraperEvent: (callback) => {
    ipcRenderer.on("scraper-event", (event, data) => callback(data));
  },
  removeScraperListeners: () => {
    ipcRenderer.removeAllListeners("scraper-event");
  },
});