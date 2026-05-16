Replace icon-192.png and icon-512.png with rasterized PNG versions of icon.svg for best PWA support on Android.

A quick way:
  npx sharp-cli -i icon.svg -o icon-192.png resize 192
  npx sharp-cli -i icon.svg -o icon-512.png resize 512

If those PNGs are missing the SVG fallback in manifest.webmanifest still works on most modern browsers and on Android.
