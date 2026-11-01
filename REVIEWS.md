# Product reviews

Reviews are Markdown files. One file is one review. Merging that file to `main` rebuilds the pages and deploys the site.

## Add a review

1. Copy `reviews/posts/example-product-review.md` to a new file in `reviews/posts/`. Name it in lowercase with hyphens, such as `reviews/posts/usb-mic.md`.
2. Put the product photo in `reviews/images/` (JPG, PNG, or WebP works best).
3. Replace the front matter and the write-up with the real product. Keep `draft: true` until the review is finished.
4. Set `draft: false` when it should be public.
5. Preview on your machine:

   ```bash
   node scripts/build-reviews.js
   ```

   Open `reviews/index.html`.
6. Commit the Markdown file and the image. Do not commit the generated HTML, `reviews/feed.xml`, or `sitemap.xml`. Those are rebuilt on deploy.
7. Delete `reviews/posts/example-product-review.md` when you no longer want the template on the draft list.

`draft: true` still builds a preview page at `reviews/drafts/<file-name>.html` so you can check the layout. Drafts are labeled as examples, marked `noindex`, and left out of the sitemap, RSS feed, and review structured data. Only `draft: false` posts appear in the published list.

## Front matter

```yaml
---
title: "Short review title"
date: 2026-11-01
category: "Tools"
summary: "One or two sentences for the reviews list."
description: "Optional. Used for the meta description and social cards. Defaults to summary."
image: "images/usb-mic.jpg"
rating: 4.5
productName: "Full product name"
brand: "Optional brand"
verdict: "One sentence on whether you would buy it again."
pros:
  - "What you liked"
cons:
  - "What you did not like"
affiliateUrl: "https://www.amazon.com/dp/ASIN?tag=yourtag-20"
draft: false
---
```

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | Page title and listing title. |
| `date` | yes | `YYYY-MM-DD`. The list is newest first. |
| `category` | yes | Shown on the card and the review. |
| `summary` | yes | Card text. Also the meta description if `description` is omitted. |
| `description` | no | Meta description and Open Graph description. |
| `image` | no | Path relative to `reviews/`, usually `images/photo.jpg`, or an absolute `https://` URL. |
| `rating` | yes | Number from 0 to 5. Halves are fine (`4.5`). |
| `verdict` | yes | Short line next to the stars. |
| `pros` | yes | YAML list. At least one item. Plain text. |
| `cons` | yes | YAML list. At least one item. Plain text. |
| `affiliateUrl` | yes | Full Amazon URL, including your Associates tag as `tag=yourtag-20`. |
| `productName` | no | Defaults to `title`. Used for the photo alt text and structured data. |
| `brand` | no | Included in Product structured data when set. |
| `author` | no | Defaults to Christopher Macabugao. |
| `updated` | no | `YYYY-MM-DD`. Used as the sitemap `lastmod` when set. |
| `draft` | no | `true` or `false`. Omitted means published. |

Quote any value that contains a colon.

## Write-up

Under the closing `---`, write normal Markdown:

- `#` and `##` for sections (the page title is already the review title)
- paragraphs, `**bold**`, `*italic*`, lists, quotes, and images
- links

Amazon links in the write-up (`amazon.` and `amzn.to`) are given `rel="sponsored nofollow noopener"` and open in a new tab. The **Check price on Amazon** button is built from `affiliateUrl` and uses that same relationship. You do not add the button yourself.

Every review page prints: "As an Amazon Associate I earn from qualifying purchases." The same line is in the site footer.

Published reviews get a page title, meta description, Open Graph tags, Product/Review JSON-LD, a sitemap entry, and an RSS item. The feed is `reviews/feed.xml`. The sitemap is `sitemap.xml`.

## Homepage

The home page shows the three newest published reviews, using the same order as the reviews index: newest `date` first, then slug. Drafts are left out.

`scripts/build-reviews.js` rewrites the block between `<!-- LATEST_REVIEWS:START -->` and `<!-- LATEST_REVIEWS:END -->` in `index.html`. Do not edit that block by hand. Both deploy workflows run the script, so publishing a review updates the strip without a separate homepage edit. A local build rewrites that block in `index.html`; deploy regenerates it either way.

## Deploy

The live domain `maccyberpro.click` is served by GitHub Pages, not by the Azure Static Web Apps workflow. Pages publishes whatever is on `main`, and the generated review HTML is gitignored, so the site would 404 at `/reviews/` if those files were not built during deploy.

`.github/workflows/pages.yml` is what publishes the live site. On every push to `main`, and when someone runs it manually (`workflow_dispatch`), it checks out the repo, sets up Node, runs `node scripts/build-reviews.js`, and deploys the whole site with `actions/configure-pages`, `actions/upload-pages-artifact` (`path: .`), and `actions/deploy-pages`. The `CNAME` file is part of that upload, so the custom domain stays attached. `.github` is left out of the Pages artifact; that does not affect the site.

GitHub Pages will not run this workflow until the repository Pages source is set to **GitHub Actions** (Settings → Pages → Build and deployment → Source). This repo does not change that setting by itself.

The Azure workflow (`.github/workflows/azure-static-web-apps-salmon-bush-0ac9d9c10.yml`) is unchanged and is not what serves `maccyberpro.click`.
