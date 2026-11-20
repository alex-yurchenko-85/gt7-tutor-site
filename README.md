# GT7 Tutor site

This repository holds the landing site of GT7 Tutor. GitHub Pages builds the site from the `site/` folder and serves it at <https://gt7tutor.app>.

GT7 Tutor is a self-hosted voice tutor for Gran Turismo 7. The source of the application is in the main project: <https://github.com/alex-yurchenko-85/gt7-tutor>.

## Check and test locally

You need Node.js 26 or later and pnpm.

```sh
pnpm install
pnpm check
pnpm test
```

`pnpm check` writes the links from `site/site.config.json` into `site/index.html` and checks the page. `pnpm test` runs the tests of the site check.

To see the page, open `site/index.html` in a browser.

## Licence

GPL-3.0. See `LICENSE`. The fonts have their own licence in `site/assets/fonts/OFL.txt`. The voice clips in `site/assets/voice/` come from the main project; their source and licence are in `site/assets/voice/NOTICE.md`.
