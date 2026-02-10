# XMind Web App (Client-side)

This is a pure client-side React app that parses `.xmind` files in the browser. No uploads.

## Run

You can open the app directly:

```bash
open "/Users/Benjamin_Moreno/Documents/xmind-web/index.html"
```

If you prefer a local server (recommended for some browsers), run:

```bash
python3 -m http.server --directory "/Users/Benjamin_Moreno/Documents/xmind-web" 5173
```

Then visit:

```
http://localhost:5173
```

## Dependencies (Safari fix)

Safari can block CDN scripts, so this app loads local vendor files.
Download them once:

```bash
mkdir -p "/Users/Benjamin_Moreno/Documents/xmind-web/vendor"
curl -L -o "/Users/Benjamin_Moreno/Documents/xmind-web/vendor/react.development.js" "https://unpkg.com/react@18/umd/react.development.js"
curl -L -o "/Users/Benjamin_Moreno/Documents/xmind-web/vendor/react-dom.development.js" "https://unpkg.com/react-dom@18/umd/react-dom.development.js"
curl -L -o "/Users/Benjamin_Moreno/Documents/xmind-web/vendor/jszip.min.js" "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
curl -L -o "/Users/Benjamin_Moreno/Documents/xmind-web/vendor/html2pdf.bundle.min.js" "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
curl -L -o "/Users/Benjamin_Moreno/Documents/xmind-web/vendor/babel.min.js" "https://unpkg.com/@babel/standalone/babel.min.js"
```

## Features

- Cuenta descendientes por hoja.
- Excluye nodos con texto rojo.
- Agrupa conteos para nodos con fondo verde.
- Ofusca correos y teléfonos en la salida.
- Exporta a PDF con un clic.

## Notes

- XMind 2020+ uses `content.json` (fully supported).
- XMind 8 uses `content.xml` (style metadata is limited).
