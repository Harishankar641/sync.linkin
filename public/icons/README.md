# PWA Icons

Drop two PNG files here before deploying:

- `icon-192.png` — 192x192px
- `icon-512.png` — 512x512px

Quick option: generate them at https://realfavicongenerator.net or with ImageMagick:

```
convert -size 512x512 xc:'#0a0a0a' -fill white -gravity center -pointsize 220 -annotate +0+0 'TL' icon-512.png
convert -size 192x192 xc:'#0a0a0a' -fill white -gravity center -pointsize 90  -annotate +0+0 'TL' icon-192.png
```

Until these exist the PWA still works in browsers, but "Add to Home Screen" on iOS/Android will use a generic icon.
