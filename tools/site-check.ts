import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyConfig, checkSite, versionStylesheet, type SiteConfig } from './site/check.ts';

const siteDir = resolve('site');
const htmlPath = resolve(siteDir, 'index.html');
const config = JSON.parse(readFileSync(resolve(siteDir, 'site.config.json'), 'utf8')) as SiteConfig;

const css = readFileSync(resolve(siteDir, 'styles.css'), 'utf8');
const cssVersion = createHash('sha256').update(css).digest('hex').slice(0, 10);

for (const name of ['404.html']) {
  const path = resolve(siteDir, name);
  const page = readFileSync(path, 'utf8');
  const versioned = versionStylesheet(page, cssVersion);
  if (versioned !== page) writeFileSync(path, versioned);
}

const original = readFileSync(htmlPath, 'utf8');
const html = versionStylesheet(applyConfig(original, config), cssVersion);
if (html !== original) {
  writeFileSync(htmlPath, html);
  console.log('Wrote the links from site.config.json and the stylesheet version into the pages.');
}

const problems = checkSite(
  { html, css, exists: path => existsSync(resolve(siteDir, decodeURIComponent(path))) },
  config
);
if (!config.githubUrl) console.log('Note: githubUrl is empty. The GitHub links point to "#" until publication.');
if (problems.length > 0) {
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log('Site check passed.');
}
