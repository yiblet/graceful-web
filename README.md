# Graceful Intelligence

A minimal, static Astro landing and contact page.

```sh
bun install --frozen-lockfile
bun run dev
```

The contact button decodes an obfuscated recipient on click and opens the visitor's email client. The address is not embedded in HTML or JavaScript string literals. This deters basic scrapers; browser automation can still recover it. There is no form backend.

```sh
bun run build
bun run preview
```

The production output is in `dist/`. GitHub Actions builds and deploys pushes to `main` to https://www.gracefulintelligence.com/.

GitHub Pages uses the custom domain in `public/CNAME`. Configure a DNS CNAME record for `www` pointing to `yiblet.github.io`.

The site retains `noindex, nofollow` and a crawler disallow directive. It is publicly accessible; these directives are not access controls.
