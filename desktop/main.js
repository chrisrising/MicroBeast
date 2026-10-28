// MicroBeast desktop companion. Two modes:
//  - floating (default): a frameless, see-through PC that floats over your other windows
//  - windowed: an ordinary window showing the full room, the same layout as the Android app
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

if (!app.requestSingleInstanceLock()) { app.quit(); }

// The game is laid out at one fixed size per view and the whole thing is scaled up or down,
// so text and buttons always stay in proportion to the window.
const BASE = { kb: [480, 700], desk: [400, 478] };
const SIZES = { Small: 0.8, Medium: 1, Large: 1.3 };
const MIN_SCALE = 0.55, MAX_SCALE = 2.5;
const statePath = () => path.join(app.getPath('userData'), 'window.json');
function loadState() { try { return JSON.parse(fs.readFileSync(statePath(), 'utf8')); } catch (e) { return {}; } }
function saveState(s) { try { fs.writeFileSync(statePath(), JSON.stringify(s)); } catch (e) {} }

let win, tray, st = loadState();
if (typeof st.scale !== 'number') st.scale = SIZES[st.size] || 1;
if (st.view !== 'desk') st.view = 'kb';
if (st.mode !== 'windowed') st.mode = 'float';

const dims = (view, scale) => BASE[view].map((n) => Math.round(n * scale));
const workArea = (b) => screen.getDisplayMatching(b).workArea;
// the biggest scale that still fits on the screen the window is on
function maxScaleFor(view, b) { const wa = workArea(b); return Math.min(MAX_SCALE, wa.width / BASE[view][0], wa.height / BASE[view][1]); }
function onScreen(b) {
  const wa = workArea(b);
  return { ...b, x: Math.min(Math.max(b.x, wa.x), wa.x + wa.width - b.width), y: Math.min(Math.max(b.y, wa.y), wa.y + wa.height - b.height) };
}
function zoom() { if (win) win.webContents.setZoomFactor(st.mode === 'windowed' ? 1 : st.scale); }

function create() {
  if (st.mode === 'windowed') return createWindowed();
  const [w, h] = dims(st.view, st.scale);
  const wa = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    width: w, height: h,
    x: st.x ?? wa.x + wa.width - w - 20, y: st.y ?? wa.y + wa.height - h - 10,
    frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    resizable: false, maximizable: false, fullscreenable: false, skipTaskbar: false,
    alwaysOnTop: st.onTop !== false, icon: path.join(__dirname, 'icon.png'), title: 'MicroBeast',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, backgroundThrottling: false },
  });
  win.setBounds(onScreen(win.getBounds()));
  win.setAlwaysOnTop(st.onTop !== false, 'floating');
  win.loadFile(path.join(__dirname, 'app', 'index.html'), { query: { desktop: '1', view: st.view } });
  win.webContents.on('did-finish-load', zoom);
  // Ctrl+scroll and Ctrl+plus/minus would zoom the page without resizing the window, so keep the zoom tied to the window
  win.webContents.on('zoom-changed', () => setTimeout(zoom, 0));
  win.webContents.on('before-input-event', (e, i) => { if (i.control && ['+', '-', '=', '0'].includes(i.key)) e.preventDefault(); });
  // clicks on empty space go through to whatever is underneath; the game turns this off when the pointer is over the monitor or keyboard
  win.setIgnoreMouseEvents(true, { forward: true });
  const remember = () => { if (!win) return; const b = win.getBounds(); st.x = b.x; st.y = b.y; saveState(st); };
  win.on('moved', remember);
  win.on('closed', () => { win = null; });
  startHover();
}

// windowed: a normal, resizable window with the whole room, like the phone app
function createWindowed() {
  const wa = screen.getPrimaryDisplay().workArea;
  const w = Math.min(st.ww || 460, wa.width), h = Math.min(st.wh || Math.min(940, wa.height), wa.height);
  win = new BrowserWindow({
    width: w, height: h, x: st.wx ?? Math.round(wa.x + (wa.width - w) / 2), y: st.wy ?? Math.round(wa.y + (wa.height - h) / 2),
    minWidth: 320, minHeight: 480, backgroundColor: '#121019', autoHideMenuBar: true,
    alwaysOnTop: st.onTop === true, icon: path.join(__dirname, 'icon.png'), title: 'MicroBeast',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, backgroundThrottling: false },
  });
  win.setMenu(null);
  win.setBounds(onScreen(win.getBounds()));
  win.loadFile(path.join(__dirname, 'app', 'index.html'), { query: { desktop: '1', mode: 'windowed' } });
  win.webContents.on('did-finish-load', zoom);
  win.webContents.on('zoom-changed', () => setTimeout(zoom, 0));
  const remember = () => { if (!win || win.isMinimized() || win.isMaximized()) return; const b = win.getBounds(); st.wx = b.x; st.wy = b.y; st.ww = b.width; st.wh = b.height; saveState(st); };
  win.on('moved', remember); win.on('resized', remember);
  win.on('closed', () => { win = null; });
}

// switch between floating and windowed: the window is rebuilt, the game reloads where it was (it saves first)
function setMode(m) {
  if (m !== 'windowed' && m !== 'float') return;
  if (m === st.mode) return;
  st.mode = m; saveState(st);
  stopHover();
  // build the new window before closing the old one, so the app never has zero windows (which would quit it)
  const old = win;
  if (old) old.removeAllListeners('closed');
  create();
  if (old && !old.isDestroyed()) old.destroy();
}

// tell the game when the pointer is over the window, so it can show the minimise and close buttons
let hoverTimer = null, hoverOn = false;
function startHover() {
  stopHover();
  hoverTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const p = screen.getCursorScreenPoint(), b = win.getBounds();
    const on = win.isVisible() && p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
    if (on !== hoverOn) { hoverOn = on; win.webContents.send('mb:hover', on); }
  }, 150);
}
function stopHover() { if (hoverTimer) clearInterval(hoverTimer); hoverTimer = null; hoverOn = false; }

// resize to a new scale and/or view, keeping one corner of the window still
function apply(scale, view, anchor) {
  if (!win) return;
  const b = win.getBounds();
  view = view || st.view;
  scale = Math.max(MIN_SCALE, Math.min(scale, maxScaleFor(view, b)));
  const [w, h] = dims(view, scale);
  let x = b.x, y = b.y;
  if (anchor === 'bottom') { x = Math.round(b.x + (b.width - w) / 2); y = b.y + b.height - h; }
  else if (anchor === 'bottomright') { x = b.x + b.width - w; y = b.y + b.height - h; }
  const nb = anchor === 'topleft' ? { x, y, width: w, height: h } : onScreen({ x, y, width: w, height: h });
  st.scale = scale; st.view = view;
  win.setBounds(nb);
  zoom();
  st.x = nb.x; st.y = nb.y;
}

// dragging the grip: follow the mouse from the top-left corner until the button is let go
let sizing = null;
function resizeStart() {
  if (!win || sizing || st.mode === 'windowed') return;
  const p = screen.getCursorScreenPoint(), b = win.getBounds();
  sizing = { p, b, scale: st.scale, timer: setInterval(resizeTick, 16) };
}
function resizeTick() {
  if (!sizing || !win) return resizeEnd();
  const p = screen.getCursorScreenPoint(), { b } = sizing;
  const fx = (b.width + p.x - sizing.p.x) / b.width, fy = (b.height + p.y - sizing.p.y) / b.height;
  const s = sizing.scale * Math.max(fx, fy);
  if (Math.abs(s - st.scale) > 0.002) apply(s, st.view, 'topleft');
}
function resizeEnd() {
  if (!sizing) return;
  clearInterval(sizing.timer); sizing = null;
  if (win) win.setBounds(onScreen(win.getBounds()));
  delete st.size; saveState(st);
}

function setSize(n) { if (SIZES[n] == null || st.mode === 'windowed') return; apply(SIZES[n], st.view, 'bottomright'); st.size = n; saveState(st); }
function setView(v) { if (!BASE[v] || v === st.view || st.mode === 'windowed') return; apply(st.scale, v, 'bottom'); saveState(st); }

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'tray.png')));
  tray.setToolTip('MicroBeast');
  const menu = () => Menu.buildFromTemplate([
    { label: 'Show MicroBeast', click: () => { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } },
    { label: 'Hide', click: () => win.hide() },
    { type: 'separator' },
    { label: 'Stay on top', type: 'checkbox', checked: st.onTop !== false, click: (i) => { st.onTop = i.checked; win.setAlwaysOnTop(i.checked, 'floating'); saveState(st); } },
    { label: 'Windowed (full room)', type: 'checkbox', checked: st.mode === 'windowed', click: (i) => setMode(i.checked ? 'windowed' : 'float') },
    { label: 'Size', enabled: st.mode !== 'windowed', submenu: Object.keys(SIZES).map((n) => ({ label: n, type: 'radio', checked: st.size === n, click: () => setSize(n) })) },
    { label: 'Start with Windows', type: 'checkbox', checked: !!app.getLoginItemSettings().openAtLogin,
      click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked, path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath }) },
    { type: 'separator' },
    { label: 'Quit MicroBeast', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu());
  tray.on('click', () => { if (win.isVisible() && !win.isMinimized()) win.hide(); else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  tray.on('right-click', () => tray.setContextMenu(menu()));
}

ipcMain.on('mb:quit', () => app.quit());
ipcMain.on('mb:hide', () => win && win.hide());
ipcMain.on('mb:pass', (e, on) => { if (win) win.setIgnoreMouseEvents(on, { forward: true }); });
ipcMain.on('mb:size', (e, n) => setSize(n));
ipcMain.on('mb:view', (e, v) => setView(v));
ipcMain.on('mb:mode', (e, m) => setMode(m));
ipcMain.on('mb:min', () => win && win.minimize());
ipcMain.on('mb:resizeStart', resizeStart);
ipcMain.on('mb:resizeEnd', resizeEnd);

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.whenReady().then(() => { create(); buildTray(); });
app.on('window-all-closed', () => app.quit());
