// A tiny bridge so the game can talk to the desktop window: quit, click-through, view, size and moving it about.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mbDesktop', {
  quit: () => ipcRenderer.send('mb:quit'),
  hide: () => ipcRenderer.send('mb:hide'),
  passThrough: (on) => ipcRenderer.send('mb:pass', !!on),
  setSize: (name) => ipcRenderer.send('mb:size', name),
  setView: (view) => ipcRenderer.send('mb:view', view),
  resizeStart: () => ipcRenderer.send('mb:resizeStart'),
  resizeEnd: () => ipcRenderer.send('mb:resizeEnd'),
});
