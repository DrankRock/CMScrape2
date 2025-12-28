const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { Scraper } = require("./scraper");

let mainWindow;
let scraper = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    backgroundColor: "#1a1a2e",
    title: "CMScrape - Ulixe Hero version",
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Open DevTools in dev mode
  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", async () => {
  if (scraper) {
    await scraper.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

ipcMain.handle("select-output-dir", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "Select Output Directory",
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("load-file", async (event, type) => {
  const filters =
    type === "urls"
      ? [{ name: "Text Files", extensions: ["txt"] }]
      : [{ name: "Text Files", extensions: ["txt"] }];

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters,
    title: `Select ${type === "urls" ? "URLs" : "XPaths"} File`,
  });

  if (result.canceled) return null;

  const content = fs.readFileSync(result.filePaths[0], "utf-8");
  return { path: result.filePaths[0], content };
});

ipcMain.handle("start-scrape", async (event, config) => {
  try {
    scraper = new Scraper(config, (type, data) => {
      mainWindow.webContents.send("scraper-event", { type, data });
    });

    const results = await scraper.run();
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("stop-scrape", async () => {
  if (scraper) {
    await scraper.stop();
    scraper = null;
  }
  return { success: true };
});