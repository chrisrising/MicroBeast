// MicroBeast desktop companion: a frameless, see-through window that floats over your other windows.
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

if (!app.requestSingleInstanceLock()) { app.quit(); }

const SIZES = { Small: [400, 640], Medium: [480, 700], Large: [600, 880] };
const statePath = () => path.join(app.getPath('userData'), 'window.json');
function loadState() { try { return JSON.parse(fs.readFileSync(statePath(), 'utf8')); } catch (e) { return {}; } }
function saveState(s) { try { fs.writeFileSync(statePath(), JSON.stringify(s)); } catch (e) {} }

let win, tray, st = loadState();

function create() {
  const [w, h] = SIZES[st.size] || SIZES.Medium;
  const wa = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    width: w, height: h,
    x: st.x ?? wa.x + wa.width - w - 20, y: st.y ?? wa.y + wa.height - h - 10,
    frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    resizable: false, maximizable: false, fullscreenable: false, skipTaskbar: false,
    alwaysOnTop: st.onTop !== false, icon: path.join(__dirname, 'icon.png'), title: 'MicroBeast',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, backgroundThrottling: false },
  });
  win.setAlwaysOnTop(st.onTop !== false, 'floating');
  win.loadFile(path.join(__dirname, 'app', 'index.html'), { query: { desktop: '1' } });
  // clicks on empty space go through to whatever is underneath; the game turns this off when the pointer is over the monitor or keyboard
  win.setIgnoreMouseEvents(true, { forward: true });
  const remember = () => { if (!win) return; const b = win.getBounds(); st.x = b.x; st.y = b.y; saveState(st); };
  win.on('moved', remember);
  win.on('closed', () => { win = null; });
}

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'tray.png')));
  tray.setToolTip('MicroBeast');
  const menu = () => Menu.buildFromTemplate([
    { label: 'Show MicroBeast', click: () => { win.show(); win.focus(); } },
    { label: 'Hide', click: () => win.hide() },
    { type: 'separator' },
    { label: 'Stay on top', type: 'checkbox', checked: st.onTop !== false, click: (i) => { st.onTop = i.checked; win.setAlwaysOnTop(i.checked, 'floating'); saveState(st); } },
    { label: 'Size', submenu: Object.keys(SIZES).map((n) => ({ label: n, type: 'radio', checked: (st.size || 'Medium') === n, click: () => setSize(n) })) },
    { label: 'Start with Windows', type: 'checkbox', checked: !!app.getLoginItemSettings().openAtLogin,
      click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked, path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath }) },
    { type: 'separator' },
    { label: 'Quit MicroBeast', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu());
  tray.on('click', () => { if (win.isVisible()) win.hide(); else { win.show(); win.focus(); } });
  tray.on('right-click', () => tray.setContextMenu(menu()));
}

function setSize(n) {
  if (!SIZES[n]) return; st.size = n; saveState(st);
  const b = win.getBounds(), [w, h] = SIZES[n];
  win.setBounds({ x: b.x + b.width - w, y: b.y + b.height - h, width: w, height: h });
}

ipcMain.on('mb:quit', () => app.quit());
ipcMain.on('mb:hide', () => win && win.hide());
ipcMain.on('mb:pass', (e, on) => { if (win) win.setIgnoreMouseEvents(on, { forward: true }); });
ipcMain.on('mb:size', (e, n) => setSize(n));

app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
app.whenReady().then(() => { create(); buildTray(); });
app.on('window-all-closed', () => app.quit());
