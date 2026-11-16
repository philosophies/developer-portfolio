import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = {
  '/': ['index.html', 'text/html'],
  '/style.css': ['style.css', 'text/css'],
  '/theme.css': ['style.css', 'text/css'],
  '/project.css': ['public/project.css', 'text/css'],
  '/fonts/IBMPlexSans.woff2': ['fonts/IBMPlexSans.woff2', 'font/woff2'],
  '/fonts/Rajdhani-SemiBold.woff2': ['fonts/Rajdhani-SemiBold.woff2', 'font/woff2'],
};
createServer(async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost');
  const path = requestUrl.pathname;
  if (path === '/__qa/desktop' || path === '/__qa/phone') {
    const target =
      { portfolio: '/', reporting: '/demos/reporting/', 'smart-brain': '/demos/smart-brain/' }[
        requestUrl.searchParams.get('target') ?? 'portfolio'
      ] ?? '/';
    const desktop = path.endsWith('desktop'),
      width = desktop ? 1440 : 390,
      height = desktop ? 1000 : 844,
      scale = desktop ? 0.4 : 1;
    res.setHeader('Content-Type', 'text/html');
    return res.end(
      `<!doctype html><html lang="en"><meta charset="utf-8"><title>Portfolio responsive verification</title><style>body{margin:16px;background:#262b36;color:#fff;font:14px system-ui}iframe{border:0;width:${width}px;height:${height}px;transform:scale(${scale});transform-origin:top left}.frame{overflow:hidden;height:${height * scale}px;width:${width * scale}px}p{margin:0 0 14px}</style><p>${desktop ? 'Desktop' : 'Phone'} viewport: ${width} × ${height}. ${desktop ? 'Scaled for this preview panel; layout is rendered at full desktop width.' : 'Actual-size phone frame.'}</p><div class="frame"><iframe title="Portfolio ${desktop ? 'desktop' : 'phone'} layout" src="${target}"></iframe></div></html>`,
    );
  }
  let item = files[path];
  if (
    !item &&
    !path.includes('%') &&
    (path.startsWith('/projects/') || path.startsWith('/demos/'))
  ) {
    const asset = path.endsWith('/') ? path + 'index.html' : path;
    const type = {
      html: 'text/html',
      js: 'text/javascript',
      css: 'text/css',
      json: 'application/json',
      svg: 'image/svg+xml',
      woff2: 'font/woff2',
    }[asset.split('.').pop()];
    if (type) item = ['public' + asset, type];
  }
  if (!item) {
    res.writeHead(404);
    return res.end('Not found');
  }
  try {
    res.setHeader('Content-Type', item[1]);
    res.end(await readFile(new URL('./' + item[0], import.meta.url)));
  } catch {
    res.writeHead(500);
    res.end('Preview asset unavailable');
  }
}).listen(4173, '127.0.0.1', () => console.log('http://127.0.0.1:4173'));
