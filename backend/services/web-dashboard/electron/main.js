const { app, BrowserWindow, Menu, globalShortcut } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadURL("http://localhost:3000");

  win.on("focus", () => {
    globalShortcut.register("F5", () => {
      win.reload();
    });
    globalShortcut.register("CommandOrControl+R", () => {
      win.reload();
    });
  });

  win.on("blur", () => {
    globalShortcut.unregisterAll();
  });

  win.setMenuBarVisibility(false);
  win.setAutoHideMenuBar(true);
}

Menu.setApplicationMenu(null);

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
