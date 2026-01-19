import { app, BrowserWindow, protocol, Menu } from 'electron'

import path from 'path'

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      contextIsolation: true
    }
  })

  win.webContents.openDevTools()
  win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  // Register protocol to serve files with proper CORS headers for WASM
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.substring(6) // remove 'app://'
    callback({ path: path.normalize(`${__dirname}/../renderer/${url}`) })
  })

  Menu.setApplicationMenu(null); // hide default menu
  
  createWindow()
})