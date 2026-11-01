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

## Deploy

The site is static HTML, CSS, and JavaScript. GitHub Actions (`.github/workflows/azure-static-web-apps-salmon-bush-0ac9d9c10.yml`) deploys it to Azure Static Web Apps.

- A push to `main` runs the review build, then uploads the site to production. The custom domain in `CNAME` is `maccyberpro.click`.
- A pull request builds a preview. Closing the pull request removes that preview.

Azure does not run a framework build (`skip_app_build: true`). The workflow runs `node scripts/build-reviews.js` first, which is why adding the Markdown file is enough.
