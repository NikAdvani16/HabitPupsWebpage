# Habit Pups website

The App Store support and privacy pages, as a static site: no build step, no server code.

| File | What it is |
|---|---|
| `index.html` | Home page: the pup studio, a few lines about the app, FAQs, contact |
| `privacy.html` | Privacy policy (the App Store's Privacy Policy URL, and the paywall's link) |
| `guides/`, `compare/`, `press/` | Guides, the comparison page and the press kit (generated: see below) |
| `robots.txt`, `sitemap.xml`, `llms.txt` | For search engines and AI assistants |
| `404.html`, `_headers` | Cloudflare Pages: the not-found page, and caching headers |
| `styles.css` | Shared styles, in the app's colours |
| `js/site.js` | The pup studio: breed, trick, outfit and mood controls |
| `js/pup/` | The app's own dog, in JavaScript (see below) |
| `assets/` | App icon, logo, favicons |
| `assets/screens/` | The App Store screenshots, as web-sized JPEGs, for the "Take a look around" reel |
| `assets/widgets/` | The large and medium widgets cut from real Home Screen captures, and the Lock Screen ring |

## The dog

`js/pup/` is a line-for-line port of the app's renderer and motion engine
(`Shared/UI/Puppy*.swift`), so the web dog is the app's dog: the same breeds, tricks and
outfits, drawn the same way. `gfx.js` stands in for SwiftUI's `Path` and
`GraphicsContext` on the HTML canvas; the rest mirror their Swift files.

`js/pup/data.js` (breeds and tricks) is generated from the app's Swift, not hand-written.
After changing a breed or a clip in the app, run this from the app's repository:

```bash
Tools/export-website-data.sh ~/HabitPupsWebpage
```

A change to how dogs are *drawn* or *move* in Swift has to be made in the matching
`js/pup/` file too. Checked so far: motion matches Swift to within 1e-9 on every channel,
and renders agree pixel for pixel except for edge smoothing.

## Before launch

- **App Store link:** in `index.html`, set the store button's `href` and remove
  `aria-disabled="true"` (and change "Coming soon to the" to "Download on the").
- **Support email:** `support@habitpups.app` appears in `index.html`, `privacy.html` and
  the app (`SupportMail.address`). Change all three together.
- **Domain:** the app links to `https://habitpups.app/privacy.html` (`Legal.privacy` in
  `PlusStore.swift`). If the site lives elsewhere, update that.

## Screenshots

The reel and the press kit show the App Store screenshots, which live in the app's
repository (`Branding/AppStoreScreenshots/` in HabitZoo). After retaking them, run this
from the app's repository to refresh the web copies:

```bash
for f in Branding/AppStoreScreenshots/*.png; do n=$(basename "$f" .png); sips -s format jpeg -s formatOptions 82 --resampleWidth 600 "$f" --out ~/HabitPupsWebpage/assets/screens/$n.jpg; sips -s format jpeg -s formatOptions 90 "$f" --out ~/HabitPupsWebpage/assets/press/$n.jpg; done
```

## Search and AI assistants

- **Every page** has a title and description that say "habit tracker", a canonical URL,
  and a share image (`assets/og-image.jpg`, 1200 × 630).
- **Structured data:** `index.html` describes the app (`MobileApplication`, with prices) and
  its FAQ (`FAQPage`); the other pages carry `Article` or breadcrumb data.
- **Crawlers:** `robots.txt` lets every crawler in, AI ones included, and points to
  `sitemap.xml`. `llms.txt` is a plain-text summary for AI tools.
- **The guide, compare and press pages** (`guides/`, `compare/`, `press/`) are written by
  `Tools/build-website-pages.py` in the app's repository, which also rebuilds the FAQ structured data from the
  FAQ on the home page. Edit the script, not the generated HTML, then run:

  ```bash
  python3 Tools/build-website-pages.py ~/HabitPupsWebpage
  ```

  Also run it after changing the FAQ in `index.html`. Add any new page to `sitemap.xml`.
- **Keep facts in step with the app:** prices, breed, trick and reward counts appear in
  `index.html`, `llms.txt`, the press page and the structured data.

## Hosting (GitHub + Cloudflare Pages)

This repository is the whole site: nothing in it depends on anything outside it.

1. Push the repository to GitHub (a private repository is fine).
2. In Cloudflare: **Workers & Pages › Create › Pages › Connect to Git**, and pick the
   repository.
3. Build settings: framework preset **None**, build command **empty**, build output
   directory **`/`**. Save and deploy. The site is live at `<project>.pages.dev`.
4. **Custom domain:** in the Pages project, **Custom domains › Set up a domain**. If the
   domain's DNS is on Cloudflare it's one click; otherwise Cloudflare shows the record to add.
5. Every push to the main branch redeploys; other branches get preview URLs.

`_headers` sets caching for `assets/` and two security headers. `404.html` is served for
missing pages. Cloudflare serves `privacy.html` at `/privacy` too.

**Using a domain other than habitpups.app:** every absolute URL is `https://habitpups.app`.
Replace it everywhere (and `Legal.privacy` in `HabitPups/Services/PlusStore.swift`):

```bash
grep -rl 'habitpups.app' . ../Workspace/HabitZoo/Tools/build-website-pages.py | xargs sed -i '' 's#https://habitpups.app#https://YOUR-DOMAIN#g'
```

**Once it's live:** add the site to Google Search Console and Bing Webmaster Tools and submit
`https://habitpups.app/sitemap.xml` in both. (ChatGPT's web search relies on Bing.)

To preview locally: `python3 -m http.server 8766` in this folder, then open
http://localhost:8766.
