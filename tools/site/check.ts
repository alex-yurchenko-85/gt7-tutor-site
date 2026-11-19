export const DISCLAIMER =
  'GT7 Tutor is an unofficial fan project. It is not affiliated with or endorsed by Sony Interactive Entertainment or Polyphony Digital. Gran Turismo is a trademark or registered trademark of Sony Interactive Entertainment Inc.';

export const CRAWLER_FILES = ['robots.txt', 'sitemap.xml', '404.html'];

export type DonateLinks = { kofi: string; buyMeACoffee: string };

export type SiteConfig = { githubUrl: string; donate: DonateLinks | null };

const DONATE_LINKS = [
  { name: 'donate-kofi', label: 'Ko-fi', url: (links: DonateLinks) => links.kofi },
  { name: 'donate-buymeacoffee', label: 'Buy Me a Coffee', url: (links: DonateLinks) => links.buyMeACoffee }
] as const;

export type SiteFiles = { html: string; css: string; exists(path: string): boolean };

const DONATE_SECTION = /<(section|template) data-section="donate">([\s\S]*?)<\/\1>/g;
const PLACEHOLDER_HREF = '#';
export const README_DEMO_ANCHOR = 'try-the-demo-without-a-console';
export const README_SETUP_ANCHOR = 'what-you-need';

function linkHref(url: string | null): string {
  return url ? url : PLACEHOLDER_HREF;
}

function readmeHref(githubUrl: string, anchor: string): string {
  return githubUrl ? `${githubUrl}#${anchor}` : PLACEHOLDER_HREF;
}

function setLink(html: string, name: string, url: string | null): string {
  return html.replace(new RegExp(`(<a\\b[^>]*\\sdata-link="${name}" href=")[^"]*"`, 'g'), `$1${linkHref(url)}"`);
}

export function applyConfig(html: string, config: SiteConfig): string {
  const withGithub = setLink(html, 'github', config.githubUrl);
  const withDemo = setLink(withGithub, 'github-demo', readmeHref(config.githubUrl, README_DEMO_ANCHOR));
  const withSetup = setLink(withDemo, 'github-setup', readmeHref(config.githubUrl, README_SETUP_ANCHOR));
  const linked = DONATE_LINKS.reduce((html, link) => setLink(html, link.name, config.donate ? link.url(config.donate) : null), withSetup);
  const element = config.donate ? 'section' : 'template';
  return linked.replace(DONATE_SECTION, (_, _element: string, content: string) => `<${element} data-section="donate">${content}</${element}>`);
}

export function versionStylesheet(html: string, version: string): string {
  return html.replace(/(<link rel="stylesheet" href="\/?styles\.css)(\?v=[^"]*)?"/g, `$1?v=${version}"`);
}

type Tag = { name: string; attributes: Map<string, string> };

function tags(html: string): Tag[] {
  const found: Tag[] = [];
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const attributes = new Map<string, string>();
    for (const attribute of match[2]!.matchAll(/([a-z-:]+)(?:="([^"]*)")?/gi)) attributes.set(attribute[1]!.toLowerCase(), attribute[2] ?? '');
    found.push({ name: match[1]!.toLowerCase(), attributes });
  }
  return found;
}

function withoutTemplates(html: string): string {
  return html.replace(/<template\b[\s\S]*?<\/template>/gi, '');
}

function isExternal(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//');
}

function localPath(url: string): string | null {
  if (isExternal(url) || url.startsWith('#') || url === '') return null;
  const path = url.split(/[?#]/)[0]!.replace(/^\.\//, '');
  return path === '' ? null : path;
}

function cssUrls(css: string): string[] {
  const urls = [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(match => match[1]!);
  const imports = [...css.matchAll(/@import\s+["']([^"']+)["']/g)].map(match => match[1]!);
  return [...urls, ...imports];
}

function missingFiles(files: SiteFiles, page: Tag[]): string[] {
  const references = [
    ...page.filter(tag => tag.name === 'a' || tag.name === 'link').map(tag => tag.attributes.get('href') ?? ''),
    ...page.filter(tag => ['img', 'source', 'script', 'iframe'].includes(tag.name)).map(tag => tag.attributes.get('src') ?? ''),
    ...page.filter(tag => tag.name === 'meta' && tag.attributes.get('property') === 'og:image').map(tag => tag.attributes.get('content') ?? ''),
    ...cssUrls(files.css)
  ];
  const paths = references.map(localPath).filter((path): path is string => path !== null);
  return [...new Set(paths)].filter(path => !files.exists(path)).map(path => `Local file is missing: ${path}`);
}

function externalResources(files: SiteFiles, page: Tag[]): string[] {
  const problems: string[] = [];
  if (page.some(tag => tag.name === 'script')) problems.push('The page has a script. It must have none.');
  if (page.some(tag => tag.name === 'iframe' || tag.name === 'embed' || tag.name === 'object')) problems.push('The page embeds another document.');
  const loadsResource = (tag: Tag) => tag.name === 'link' && tag.attributes.get('rel') !== 'canonical';
  for (const tag of page.filter(candidate => loadsResource(candidate) && isExternal(candidate.attributes.get('href') ?? ''))) {
    problems.push(`The page loads an external resource: ${tag.attributes.get('href')}`);
  }
  for (const tag of page.filter(candidate => ['img', 'source', 'video', 'audio'].includes(candidate.name) && isExternal(candidate.attributes.get('src') ?? ''))) {
    problems.push(`The page loads an external image or media file: ${tag.attributes.get('src')}`);
  }
  for (const url of cssUrls(files.css).filter(isExternal)) problems.push(`The stylesheet loads an external resource: ${url}`);
  return problems;
}

function configuredLinks(html: string, page: Tag[], config: SiteConfig): string[] {
  const problems: string[] = [];
  const hrefs = (name: string) => page.filter(tag => tag.name === 'a' && tag.attributes.get('data-link') === name).map(tag => tag.attributes.get('href'));
  const github = hrefs('github');
  if (github.length === 0) problems.push('The page has no github link.');
  if (github.some(href => href !== linkHref(config.githubUrl))) problems.push('A github link does not match site.config.json.');
  if (hrefs('github-demo').some(href => href !== readmeHref(config.githubUrl, README_DEMO_ANCHOR))) problems.push('A demo link does not point to the demo section of the README.');
  if (hrefs('github-setup').some(href => href !== readmeHref(config.githubUrl, README_SETUP_ANCHOR))) problems.push('A setup link does not point to the setup section of the README.');
  const section = /<section data-section="donate">/.test(html);
  const donateHrefs = DONATE_LINKS.flatMap(link => hrefs(link.name));
  if (config.donate === null) {
    if (section || donateHrefs.length > 0) problems.push('The donate section is on the page, but donate is null.');
    return problems;
  }
  if (!section) problems.push('The donate section is missing, but donate is set.');
  for (const link of DONATE_LINKS) {
    const found = hrefs(link.name);
    if (found.length === 0) problems.push(`The page has no ${link.label} link.`);
    if (found.some(href => href !== link.url(config.donate!))) problems.push(`A ${link.label} link does not match site.config.json.`);
  }
  return problems;
}

function metadata(page: Tag[]): string[] {
  const problems: string[] = [];
  const meta = (key: string, value: string) => page.find(tag => tag.name === 'meta' && tag.attributes.get(key) === value)?.attributes.get('content');
  if (!page.some(tag => tag.name === 'title')) problems.push('The page has no title.');
  if (!meta('name', 'description')) problems.push('The page has no description.');
  if (!meta('property', 'og:image')) problems.push('The page has no social image (og:image).');
  if (!page.some(tag => tag.name === 'link' && tag.attributes.get('rel') === 'canonical' && tag.attributes.get('href'))) problems.push('The page has no canonical link.');
  return problems;
}

function crawlerFiles(files: SiteFiles): string[] {
  return CRAWLER_FILES.filter(path => !files.exists(path)).map(path => `Site file is missing: ${path}`);
}

function images(page: Tag[]): string[] {
  return page
    .filter(tag => tag.name === 'img')
    .flatMap(tag => {
      const src = tag.attributes.get('src') ?? '(no src)';
      const problems: string[] = [];
      if (!tag.attributes.get('alt')?.trim()) problems.push(`Image has no alt text: ${src}`);
      if (!/^\d+$/.test(tag.attributes.get('width') ?? '') || !/^\d+$/.test(tag.attributes.get('height') ?? '')) {
        problems.push(`Image has no width and height: ${src}`);
      }
      return problems;
    });
}

export function checkSite(files: SiteFiles, config: SiteConfig): string[] {
  const visible = withoutTemplates(files.html);
  const page = tags(visible);
  return [
    ...missingFiles(files, page),
    ...externalResources(files, page),
    ...configuredLinks(visible, page, config),
    ...(files.html.includes(DISCLAIMER) ? [] : ['The disclaimer line is missing or changed.']),
    ...metadata(page),
    ...crawlerFiles(files),
    ...images(page)
  ];
}
