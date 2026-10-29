// A tiny bridge so the game can talk to the desktop window: quit, click-through, view, size and moving it about.
const { contextBridge, ipcRenderer } = require('electron');
// First run on the website version: bring the save across from the old built-in copy (only if this has no save yet).
try {
  if (location.protocol === 'https:' || location.protocol === 'http:') {
    const old = ipcRenderer.sendSync('mb:oldsave');
    if (old && !localStorage.getItem('fuselings.world')) for (const k in old) localStorage.setItem(k, old[k]);
    if (old) ipcRenderer.send('mb:migrated');
  }
} catch (e) {}
contextBridge.exposeInMainWorld('mbDesktop', {
  quit: () => ipcRenderer.send('mb:quit'),
  hide: () => ipcRenderer.send('mb:hide'),
  passThrough: (on) => ipcRenderer.send('mb:pass', !!on),
  setSize: (name) => ipcRenderer.send('mb:size', name),
  setView: (view) => ipcRenderer.send('mb:view', view),
  resizeStart: () => ipcRenderer.send('mb:resizeStart'),
  resizeEnd: () => ipcRenderer.send('mb:resizeEnd'),
  setMode: (mode) => ipcRenderer.send('mb:mode', mode),
  minimize: () => ipcRenderer.send('mb:min'),
  fit: (h) => ipcRenderer.send('mb:fit', h),
  onHover: (cb) => ipcRenderer.on('mb:hover', (e, on) => cb(!!on)),
});
