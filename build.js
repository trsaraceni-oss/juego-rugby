#!/usr/bin/env node
/* build.js - arma una version de un solo archivo, para compartir o publicar.
   Uso: node build.js [salida]        (por defecto dist/rugby-board.html)
        node build.js --fragment out  (sin doctype/head/body, para incrustar) */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SCRIPTS = ['js/geom.js', 'js/model.js', 'js/demos.js', 'js/field.js', 'js/render.js', 'js/mp4.js', 'js/video.js', 'js/input.js', 'js/ui.js', 'js/app.js'];
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = args.filter((a) => !a.startsWith('--'))[0] || (fragment ? 'dist/rugby-board.fragment.html' : 'dist/rugby-board.html');

const html = read('index.html');
const css = read('css/app.css');
const js = SCRIPTS.map((f) => '/* ===== ' + f + ' ===== */\n' + read(f)).join('\n');

/* cuerpo de index.html sin los <script src> ni el <link> */
const body = html
  .slice(html.indexOf('<div id="app">'), html.lastIndexOf('</div>') + 6)
  .trim();

const head = '<title>Rugby Board</title>\n<style>\n' + css + '\n</style>';
const tail = '<script>\n' + js + '\n</script>';

const doc = fragment
  ? head + '\n' + body + '\n' + tail + '\n'
  : '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    head + '\n</head>\n<body>\n' + body + '\n' + tail + '\n</body>\n</html>\n';

const dest = path.resolve(ROOT, out);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, doc);
console.log(out + ' — ' + Math.round(doc.length / 1024) + ' KB');
