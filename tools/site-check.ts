import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyConfig, checkSite, type SiteConfig } from './site/check.ts';

const siteDir = resolve('site');
const htmlPath = resolve(siteDir, 'index.html');
const config = JSON.parse(readFileSync(resolve(siteDir, 'site.config.json'), 'utf8')) as SiteConfig;

const original = readFileSync(htmlPath, 'utf8');
const html = applyConfig(original, config);
if (html !== original) {
  writeFileSync(htmlPath, html);
  console.log('Wrote the links from site.config.json into site/index.html.');
}

const problems = checkSite(
  { html, css: readFileSync(resolve(siteDir, 'styles.css'), 'utf8'), exists: path => existsSync(resolve(siteDir, decodeURIComponent(path))) },
  config
);
if (!config.githubUrl) console.log('Note: githubUrl is empty. The GitHub links point to "#" until publication.');
if (problems.length > 0) {
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log('Site check passed.');
}
