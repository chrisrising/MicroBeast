"""Builds the home-screen web app into site/: the game page plus what phones need to install it."""
import shutil, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
site = root / 'site'
shutil.rmtree(site, ignore_errors=True)
shutil.copytree(root / 'web', site, ignore=shutil.ignore_patterns('build.py'))
html = (root / 'app/src/main/assets/index.html').read_text(encoding='utf-8')
import time
head = '''<script>window.MB_BUILD='''+str(int(time.time()*1000))+''';</script>
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="MicroBeast">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#121019">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<script>if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));</script>
'''
assert '</head>' in html
html = html.replace('</head>', head + '</head>', 1)
(site / 'index.html').write_text(html, encoding='utf-8')
print('built', site)
