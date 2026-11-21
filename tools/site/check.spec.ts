import { describe, expect, it } from 'vitest';
import { applyConfig, checkSite, CRAWLER_FILES, DISCLAIMER, versionStylesheet, type SiteFiles } from './check.ts';

const head = `<head><title>GT7 Tutor</title><meta name="description" content="Voice cues for GT7 exercises."><meta property="og:image" content="assets/screenshots/drive.png"><link rel="canonical" href="https://example.org/"><link rel="stylesheet" href="styles.css"></head>`;
const donate = `<a data-link="donate-kofi" href="https://ko-fi.example.org/owner">Support on Ko-fi</a><a data-link="donate-buymeacoffee" href="https://bmc.example.org/owner">Buy me a coffee</a>`;

function page(body: string, extraHead = ''): string {
  return `<!doctype html><html lang="en">${head.replace('</head>', `${extraHead}</head>`)}<body>${body}<footer><p>${DISCLAIMER}</p></footer></body></html>`;
}

const goodBody = `<a data-link="github" href="https://github.com/owner/gt7-tutor">GitHub</a>
<img src="assets/screenshots/drive.png" alt="Drive view with the cue Brake 85" width="390" height="844">
<section data-section="donate"><p>Optional.</p>${donate}</section>`;

function files(html: string, css = 'body { font-family: "Sofia Sans"; } @font-face { src: url(assets/fonts/sofia.woff2); }'): SiteFiles {
  const existing = new Set(['styles.css', 'assets/screenshots/drive.png', 'assets/fonts/sofia.woff2', ...CRAWLER_FILES]);
  return { html, css, exists: path => existing.has(path) };
}

const config = { githubUrl: 'https://github.com/owner/gt7-tutor', donate: { kofi: 'https://ko-fi.example.org/owner', buyMeACoffee: 'https://bmc.example.org/owner' } };

describe('site check', () => {
  it('accepts_a_complete_page', () => {
    expect(checkSite(files(page(goodBody)), config)).toEqual([]);
  });

  it('every_local_link_and_image_resolves', () => {
    const problems = checkSite(files(page(`${goodBody}<a href="docs/missing.html">Docs</a><img src="assets/none.png" alt="x" width="1" height="1">`), 'b { background: url(assets/gone.svg); }'), config);
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('docs/missing.html'),
        expect.stringContaining('assets/none.png'),
        expect.stringContaining('assets/gone.svg')
      ])
    );
  });

  it('no_external_script_font_or_tracker', () => {
    const external = [
      page(goodBody, '<script src="https://cdn.example.org/a.js"></script>'),
      page(goodBody, '<script>window.track = 1</script>'),
      page(goodBody, '<link rel="stylesheet" href="https://fonts.example.org/css">'),
      page(`${goodBody}<img src="https://cdn.example.org/pixel.gif" alt="" width="1" height="1">`),
      page(`${goodBody}<iframe src="https://example.org/frame"></iframe>`)
    ];
    for (const html of external) expect(checkSite(files(html), config).length, html).toBeGreaterThan(0);
    expect(checkSite(files(page(goodBody), '@import url("https://fonts.example.org/x.css");'), config).length).toBeGreaterThan(0);
    expect(checkSite(files(page(goodBody), '@font-face { src: url(https://fonts.example.org/x.woff2); }'), config).length).toBeGreaterThan(0);
  });

  it('allows_only_the_local_preview_scripts', () => {
    const local = (html: string) => ({ ...files(html), exists: (path: string) => ['assets/cue-preview.js', 'assets/race-preview.js'].includes(path) || files(html).exists(path) });
    expect(checkSite(local(page(`${goodBody}<script src="assets/cue-preview.js" defer></script>`)), config)).toEqual([]);
    expect(checkSite(local(page(`${goodBody}<script src="assets/cue-preview.js" defer></script><script src="assets/race-preview.js" defer></script>`)), config)).toEqual([]);
    expect(checkSite(local(page(`${goodBody}<script src="assets/other.js" defer></script>`)), config).length).toBeGreaterThan(0);
    expect(checkSite(local(page(`${goodBody}<script src="assets/cue-preview.js">window.track = 1</script>`)), config).length).toBeGreaterThan(0);
  });

  it('github_and_donate_links_come_from_config', () => {
    const template = page(`<a data-link="github" href="#">GitHub</a><template data-section="donate"><p>Optional.</p><a data-link="donate-kofi" href="#">Ko-fi</a><a data-link="donate-buymeacoffee" href="#">Buy me a coffee</a></template>`);
    const applied = applyConfig(template, config);
    expect(applied).toContain('<a data-link="github" href="https://github.com/owner/gt7-tutor">');
    expect(applied).toContain('<a data-link="donate-kofi" href="https://ko-fi.example.org/owner">');
    expect(applied).toContain('<a data-link="donate-buymeacoffee" href="https://bmc.example.org/owner">');
    expect(applied).toContain('<section data-section="donate">');
    expect(checkSite(files(page(goodBody)), { ...config, githubUrl: 'https://github.com/other/repo' })).toEqual([
      expect.stringContaining('github')
    ]);
  });

  it('demo_link_points_to_the_readme_demo_section', () => {
    const template = page(`${goodBody}<a data-link="github-demo" href="#">Try it without a console</a>`);
    const applied = applyConfig(template, config);
    expect(applied).toContain('<a data-link="github-demo" href="https://github.com/owner/gt7-tutor#try-the-demo-without-a-console">');
    expect(checkSite(files(applied), config)).toEqual([]);
    expect(checkSite(files(template), config)).toEqual([expect.stringContaining('demo link')]);
    expect(applyConfig(template, { ...config, githubUrl: '' })).toContain('<a data-link="github-demo" href="#">');
  });

  it('setup_link_points_to_the_readme_setup_section', () => {
    const template = page(`${goodBody}<a data-link="github-setup" href="#">Read the setup guide</a>`);
    const applied = applyConfig(template, config);
    expect(applied).toContain('<a data-link="github-setup" href="https://github.com/owner/gt7-tutor#what-you-need">');
    expect(checkSite(files(applied), config)).toEqual([]);
    expect(checkSite(files(template), config)).toEqual([expect.stringContaining('setup link')]);
    expect(applyConfig(template, { ...config, githubUrl: '' })).toContain('<a data-link="github-setup" href="#">');
  });

  it('config_sets_a_link_that_has_other_attributes_first', () => {
    const template = page(`${goodBody}<a class="button" data-link="github" href="#">Source code</a>`);
    const applied = applyConfig(template, config);
    expect(applied).toContain('<a class="button" data-link="github" href="https://github.com/owner/gt7-tutor">');
    expect(checkSite(files(applied), config)).toEqual([]);
  });

  it('null_donate_removes_the_section', () => {
    const applied = applyConfig(page(goodBody), { ...config, donate: null });
    expect(applied).not.toContain('<section data-section="donate">');
    expect(applied).toContain('<template data-section="donate">');
    expect(checkSite(files(applied), { ...config, donate: null })).toEqual([]);
    expect(checkSite(files(page(goodBody)), { ...config, donate: null })).toEqual([expect.stringContaining('donate')]);
    expect(applyConfig(applied, config)).toContain('<section data-section="donate">');
  });

  it('every_donate_block_follows_the_config', () => {
    const template = page(`<a data-link="github" href="https://github.com/owner/gt7-tutor">GitHub</a><template data-section="donate"><p>Main.</p>${donate}</template><template data-section="donate"><p>Footer.</p>${donate}</template>`);
    const shown = applyConfig(template, config);
    expect(shown.match(/<section data-section="donate">/g)).toHaveLength(2);
    expect(shown).not.toContain('<template data-section="donate">');
    expect(checkSite(files(shown), config)).toEqual([]);
    const hidden = applyConfig(shown, { ...config, donate: null });
    expect(hidden.match(/<template data-section="donate">/g)).toHaveLength(2);
    expect(checkSite(files(hidden), { ...config, donate: null })).toEqual([]);
  });

  it('each_donate_link_must_match_the_config_and_be_present', () => {
    const wrong = page(goodBody.replace('https://ko-fi.example.org/owner', 'https://ko-fi.example.org/other'));
    expect(checkSite(files(wrong), config)).toEqual([expect.stringContaining('Ko-fi')]);
    const missing = page(goodBody.replace(/<a data-link="donate-buymeacoffee"[^>]*>[^<]*<\/a>/, ''));
    expect(checkSite(files(missing), config)).toEqual([expect.stringContaining('Buy Me a Coffee')]);
  });

  it('stylesheet_link_carries_the_version_of_the_css', () => {
    const html = '<link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="/styles.css?v=old">';
    const versioned = versionStylesheet(html, 'abc123');
    expect(versioned).toBe('<link rel="stylesheet" href="styles.css?v=abc123"><link rel="stylesheet" href="/styles.css?v=abc123">');
    expect(versionStylesheet(versioned, 'abc123')).toBe(versioned);
    expect(checkSite(files(page(goodBody).replace('href="styles.css"', 'href="styles.css?v=abc123"')), config)).toEqual([]);
  });

  it('disclaimer_line_is_present_verbatim', () => {
    const changed = page(goodBody).replace('not affiliated', 'not connected');
    expect(checkSite(files(changed), config)).toEqual([expect.stringContaining('disclaimer')]);
  });

  it('page_has_title_description_and_social_image', () => {
    for (const missing of ['<title>GT7 Tutor</title>', '<meta name="description" content="Voice cues for GT7 exercises.">', '<meta property="og:image" content="assets/screenshots/drive.png">', '<link rel="canonical" href="https://example.org/">']) {
      expect(checkSite(files(page(goodBody).replace(missing, '')), config).length, missing).toBeGreaterThan(0);
    }
  });

  it('site_has_robots_sitemap_and_not_found_page', () => {
    expect(CRAWLER_FILES).toEqual(['robots.txt', 'sitemap.xml', '404.html']);
    for (const missing of CRAWLER_FILES) {
      const html = page(goodBody);
      const withoutFile: SiteFiles = { ...files(html), exists: path => path !== missing && files(html).exists(path) };
      expect(checkSite(withoutFile, config), missing).toEqual([expect.stringContaining(missing)]);
    }
  });

  it('every_image_has_alt_text_and_dimensions', () => {
    const variants = [
      '<img src="assets/screenshots/drive.png" width="390" height="844">',
      '<img src="assets/screenshots/drive.png" alt="" width="390" height="844">',
      '<img src="assets/screenshots/drive.png" alt="Drive" height="844">',
      '<img src="assets/screenshots/drive.png" alt="Drive" width="390">'
    ];
    for (const image of variants) {
      expect(checkSite(files(page(`${goodBody}${image}`)), config).length, image).toBeGreaterThan(0);
    }
  });
});
