# Palwardens for Android

A small Android app that runs the Palwardens creature-care game from its own files.

## Get the APK (GitHub does the build)

1. Push this folder to a GitHub repository (Claude can do this for you).
2. GitHub builds the app automatically. After about 5 minutes, open the repository's **Releases** page on your phone and download `Palwardens.apk`.
3. Open the file to install. The first time, Android asks you to allow installs from your browser.

## Notes

- Your pet is saved on the phone and keeps ageing while the app is closed.
- The phone's back button closes menus and quits the Play minigame.
- The pixel fonts load from the internet when available; offline they fall back to built-in monospace fonts.
- Friend QR codes link to the web version of the game, so friends without the app can still battle.
- The game lives in `app/src/main/assets/index.html`. Replace it and push to build a new version.
