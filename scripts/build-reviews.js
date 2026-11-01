#!/usr/bin/env node
/**
 * Build the product-review pages from reviews/posts/*.md.
 *
 * Usage:
 *   node scripts/build-reviews.js            # write pages, sitemap, RSS, and the homepage strip
 *   node scripts/build-reviews.js --self-test
 *
 * No dependencies. Safe to run on every deploy.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'reviews', 'posts');
const REVIEWS_DIR = path.join(ROOT, 'reviews');
const DRAFTS_DIR = path.join(REVIEWS_DIR, 'drafts');

/** Public site origin used in canonical URLs, Open Graph, sitemap, and RSS. */
const SITE_ORIGIN = 'https://www.maccyberpro.click';
const SITE_NAME = 'Christopher Macabugao';
const DEFAULT_AUTHOR = 'Christopher Macabugao';
const DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.';

const KNOWN_FIELDS = new Set([
    'title',
    'date',
    'category',
    'summary',
    'description',
    'image',
    'rating',
    'verdict',
    'pros',
    'cons',
    'affiliateUrl',
    'productName',
    'brand',
    'draft',
    'author',
    'updated',
]);

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeXml(value) {
    return escapeHtml(value);
}

function unquote(value) {
    const trimmed = value.trim();
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function coerce(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === '[]') return [];
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    return value;
}

function parseFrontMatter(raw, filename) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
    if (!match) {
        throw new Error(`${filename}: add front matter between --- lines at the top of the file.`);
    }

    const data = {};
    let listKey = null;

    for (const line of match[1].split(/\r?\n/)) {
        if (!line.trim() || line.trim().startsWith('#')) continue;

        const item = /^\s+-\s+(.*)$/.exec(line);
        if (item) {
            if (!listKey) {
                throw new Error(`${filename}: list item "${line.trim()}" is not under a field.`);
            }
            data[listKey].push(coerce(unquote(item[1])));
            continue;
        }

        const field = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(line);
        if (!field) {
            throw new Error(`${filename}: cannot read front-matter line "${line}".`);
        }

        const key = field[1];
        if (!KNOWN_FIELDS.has(key)) {
            throw new Error(`${filename}: unknown front-matter field "${key}". See REVIEWS.md.`);
        }

        const rawValue = field[2].trim();
        if (rawValue === '' || rawValue === '|' || rawValue === '>') {
            data[key] = [];
            listKey = key;
            continue;
        }

        listKey = null;
        data[key] = coerce(unquote(rawValue));
    }

    return { data, body: match[2].trim() };
}

function requireString(data, key, filename) {
    const value = data[key];
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${filename}: "${key}" is required.`);
    }
    return value.trim();
}

function requireList(data, key, filename) {
    const value = data[key];
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item.trim())) {
        throw new Error(`${filename}: "${key}" must be a YAML list with at least one item.`);
    }
    return value.map((item) => item.trim());
}

function parseDate(value, filename, label) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`${filename}: "${label}" must be YYYY-MM-DD.`);
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw new Error(`${filename}: "${label}" is not a real calendar date.`);
    }
    return value;
}

function loadPost(filePath) {
    const filename = path.basename(filePath);
    const slug = filename.replace(/\.md$/i, '');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error(`${filename}: use a lowercase kebab-case filename, such as usb-mic.md.`);
    }

    const parsed = parseFrontMatter(fs.readFileSync(filePath, 'utf8'), filename);
    const data = parsed.data;
    const rating = data.rating;
    if (typeof rating !== 'number' || Number.isNaN(rating) || rating < 0 || rating > 5) {
        throw new Error(`${filename}: "rating" must be a number from 0 to 5.`);
    }

    let affiliateUrl;
    try {
        affiliateUrl = new URL(requireString(data, 'affiliateUrl', filename)).href;
    } catch (error) {
        throw new Error(`${filename}: "affiliateUrl" must be a full URL. ${error.message}`);
    }

    const image = typeof data.image === 'string' ? data.image.trim() : '';
    if (image && !/^https?:\/\//i.test(image)) {
        if (image.includes('..') || image.startsWith('/')) {
            throw new Error(`${filename}: "image" must be a path inside reviews/, such as images/photo.jpg.`);
        }
        const localImage = path.join(REVIEWS_DIR, image);
        if (!fs.existsSync(localImage)) {
            throw new Error(`${filename}: image not found at reviews/${image}.`);
        }
    }

    return {
        slug,
        filename,
        title: requireString(data, 'title', filename),
        date: parseDate(data.date, filename, 'date'),
        updated: data.updated ? parseDate(data.updated, filename, 'updated') : '',
        category: requireString(data, 'category', filename),
        summary: requireString(data, 'summary', filename),
        description: typeof data.description === 'string' && data.description.trim()
            ? data.description.trim()
            : requireString(data, 'summary', filename),
        image,
        rating,
        verdict: requireString(data, 'verdict', filename),
        pros: requireList(data, 'pros', filename),
        cons: requireList(data, 'cons', filename),
        affiliateUrl,
        productName: typeof data.productName === 'string' && data.productName.trim()
            ? data.productName.trim()
            : requireString(data, 'title', filename),
        brand: typeof data.brand === 'string' ? data.brand.trim() : '',
        draft: data.draft === true,
        author: typeof data.author === 'string' && data.author.trim()
            ? data.author.trim()
            : DEFAULT_AUTHOR,
        body: parsed.body,
    };
}

function loadPosts() {
    if (!fs.existsSync(POSTS_DIR)) {
        throw new Error('Missing reviews/posts/. Add a Markdown file there. See REVIEWS.md.');
    }
    return fs
        .readdirSync(POSTS_DIR)
        .filter((name) => name.endsWith('.md'))
        .map((name) => loadPost(path.join(POSTS_DIR, name)))
        .sort(comparePosts);
}

function comparePosts(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.slug.localeCompare(b.slug);
}

function formatDate(iso) {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    });
}

function formatRating(rating) {
    return Number.isInteger(rating) ? String(rating) : String(rating);
}

function starsHtml(rating) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5 && full < 5;
    let icons = '';
    for (let i = 1; i <= 5; i += 1) {
        if (i <= full) icons += '<i class="fa-solid fa-star" aria-hidden="true"></i>';
        else if (half && i === full + 1) icons += '<i class="fa-solid fa-star-half-stroke" aria-hidden="true"></i>';
        else icons += '<i class="fa-regular fa-star" aria-hidden="true"></i>';
    }
    return `<span class="stars" role="img" aria-label="${escapeHtml(formatRating(rating))} out of 5 stars">${icons}</span>`;
}

function isAmazonUrl(url) {
    try {
        const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
        return host === 'amzn.to' || host === 'amzn.asia' || host.startsWith('amazon.') || host.includes('.amazon.');
    } catch {
        return false;
    }
}

function inlineMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => {
        return `<img src="${url}" alt="${alt}" loading="lazy">`;
    });
    html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
        const decoded = url.replace(/&amp;/g, '&');
        const affiliate = isAmazonUrl(decoded);
        const extra = affiliate ? ' target="_blank" rel="sponsored nofollow noopener"' : '';
        return `<a href="${url}"${extra}>${label}</a>`;
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return html;
}

function markdownToHtml(source) {
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let index = 0;
    const paragraph = [];

    function flushParagraph() {
        if (!paragraph.length) return;
        html += `<p>${inlineMarkdown(paragraph.join(' '))}</p>\n`;
        paragraph.length = 0;
    }

    while (index < lines.length) {
        const line = lines[index];

        if (/^\s*```/.test(line)) {
            flushParagraph();
            const code = [];
            index += 1;
            while (index < lines.length && !/^\s*```/.test(lines[index])) {
                code.push(escapeHtml(lines[index]));
                index += 1;
            }
            html += `<pre><code>${code.join('\n')}</code></pre>\n`;
            index += 1;
            continue;
        }

        if (!line.trim()) {
            flushParagraph();
            index += 1;
            continue;
        }

        const heading = /^(#{1,3})\s+(.+)$/.exec(line);
        if (heading) {
            flushParagraph();
            const level = heading[1].length + 1;
            html += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>\n`;
            index += 1;
            continue;
        }

        if (/^>\s?/.test(line)) {
            flushParagraph();
            const quote = [];
            while (index < lines.length && /^>\s?/.test(lines[index])) {
                quote.push(lines[index].replace(/^>\s?/, ''));
                index += 1;
            }
            html += `<blockquote>${inlineMarkdown(quote.join(' '))}</blockquote>\n`;
            continue;
        }

        if (/^\s*[-*]\s+/.test(line)) {
            flushParagraph();
            html += '<ul>\n';
            while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
                html += `<li>${inlineMarkdown(lines[index].replace(/^\s*[-*]\s+/, ''))}</li>\n`;
                index += 1;
            }
            html += '</ul>\n';
            continue;
        }

        if (/^\s*\d+\.\s+/.test(line)) {
            flushParagraph();
            html += '<ol>\n';
            while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
                html += `<li>${inlineMarkdown(lines[index].replace(/^\s*\d+\.\s+/, ''))}</li>\n`;
                index += 1;
            }
            html += '</ol>\n';
            continue;
        }

        if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
            flushParagraph();
            html += '<hr>\n';
            index += 1;
            continue;
        }

        paragraph.push(line.trim());
        index += 1;
    }

    flushParagraph();
    return html;
}

function plainText(markdown) {
    return markdown
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
        .replace(/[#>*_`]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function imageSrc(image, depth) {
    if (!image) return '';
    if (/^https?:\/\//i.test(image)) return image;
    const cleaned = image.replace(/^\//, '');
    return `${'../'.repeat(depth - 1)}${cleaned}`;
}

function absoluteImage(image) {
    if (!image) return '';
    if (/^https?:\/\//i.test(image)) return image;
    return `${SITE_ORIGIN}/reviews/${image.replace(/^\//, '')}`;
}

function postUrl(post) {
    const folder = post.draft ? 'reviews/drafts' : 'reviews';
    return `${SITE_ORIGIN}/${folder}/${post.slug}.html`;
}

function disclosureHtml(extraClass) {
    const classes = extraClass ? `affiliate-disclosure ${extraClass}` : 'affiliate-disclosure';
    return `<p class="${classes}">${escapeHtml(DISCLOSURE)}</p>`;
}

function amazonButton(url) {
    return `<a class="amazon-button" href="${escapeHtml(url)}" target="_blank" rel="sponsored nofollow noopener"><i class="fa-brands fa-amazon" aria-hidden="true"></i> Check price on Amazon</a>`;
}

function socialHtml() {
    const links = [
        ['https://facebook.com/profile.php?id=100080445008342', 'Facebook', 'fa-facebook-f'],
        ['https://linkedin.com/in/christopher-macabugao-3981a3148', 'LinkedIn', 'fa-linkedin-in'],
        ['https://x.com/macabucp', 'X', 'fa-x-twitter'],
        ['https://instagram.com/mai_topak808', 'Instagram', 'fa-instagram'],
        ['https://gitlab.com/maccybersolutions', 'GitLab', 'fa-gitlab'],
    ];
    return links
        .map(([href, label, icon]) => {
            return `<a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${label}"><i class="fab ${icon}" aria-hidden="true"></i></a>`;
        })
        .join('\n');
}

function siteNav(depth) {
    const root = '../'.repeat(depth);
    const reviewsHref = depth === 0 ? 'reviews/index.html' : depth === 1 ? 'index.html' : '../index.html';
    const items = [
        ['home', `${depth === 0 ? 'index.html' : `${root}index.html`}`, 'Home'],
        ['reviews', reviewsHref, 'Reviews'],
        ['about', `${root}about.html`, 'About'],
        ['contact', `${root}contact.html`, 'Contact'],
    ];
    return items
        .map(([id, href, label]) => {
            const classes = [];
            if (id === 'reviews') classes.push('nav-reviews');
            if (id === 'reviews') classes.push('nav-active');
            const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
            const current = id === 'reviews' ? ' aria-current="page"' : '';
            return `<li><a href="${href}"${classAttr}${current}>${label}</a></li>`;
        })
        .join('\n                ');
}

function homeImageSrc(image) {
    if (!image) return '';
    if (/^https?:\/\//i.test(image)) return image;
    return `reviews/${image.replace(/^\//, '')}`;
}

function homeCardHtml(post) {
    const thumb = post.image
        ? `<img class="latest-review-thumb" src="${escapeHtml(homeImageSrc(post.image))}" alt="${escapeHtml(post.productName)}" loading="lazy">`
        : '<div class="latest-review-thumb latest-review-thumb-empty" role="img" aria-label="No photo yet">No photo yet</div>';
    return `                <a class="latest-review-card" href="reviews/${post.slug}.html">
                    ${thumb}
                    <span class="latest-review-body">
                        <span class="latest-review-title">${escapeHtml(post.title)}</span>
                        <span class="latest-review-rating">${starsHtml(post.rating)} <span>${escapeHtml(formatRating(post.rating))}/5</span></span>
                        <span class="latest-review-summary">${escapeHtml(post.summary)}</span>
                    </span>
                </a>`;
}

const LATEST_START = '<!-- LATEST_REVIEWS:START -->';
const LATEST_END = '<!-- LATEST_REVIEWS:END -->';

function renderHomeLatest(posts) {
    const latest = publishedPosts(posts).slice(0, 3);
    const cards = latest.length
        ? `<div class="latest-reviews-grid">\n${latest.map(homeCardHtml).join('\n')}\n                </div>`
        : '<p class="latest-reviews-empty">No published reviews yet.</p>';

    return `            <section id="latest-reviews" class="latest-reviews" aria-labelledby="latest-reviews-heading">
                <div class="latest-reviews-inner">
                    <div class="latest-reviews-head">
                        <div>
                            <p class="projects-label"><i class="fa-solid fa-terminal" aria-hidden="true"></i> LATEST_REVIEWS.LOG</p>
                            <h2 id="latest-reviews-heading" class="latest-reviews-title">Latest Reviews</h2>
                        </div>
                        <a class="latest-reviews-all" href="reviews/index.html">See all reviews</a>
                    </div>
                    ${cards}
                    <p class="affiliate-disclosure latest-reviews-disclosure">${escapeHtml(DISCLOSURE)}</p>
                </div>
            </section>`;
}

function injectHomeLatest(posts) {
    const indexPath = path.join(ROOT, 'index.html');
    const html = fs.readFileSync(indexPath, 'utf8');
    const start = html.indexOf(LATEST_START);
    const end = html.indexOf(LATEST_END);
    if (start === -1 || end === -1 || end < start) {
        throw new Error('index.html is missing LATEST_REVIEWS markers.');
    }
    const replacement = `${LATEST_START}\n${renderHomeLatest(posts)}\n        ${LATEST_END}`;
    const next = html.slice(0, start) + replacement + html.slice(end + LATEST_END.length);
    if (next !== html) fs.writeFileSync(indexPath, next);
}

function chrome({ depth, title, description, canonical, robots, ogType, image, published, jsonLd, body }) {
    const root = '../'.repeat(depth);
    const imageMeta = image
        ? `<meta property="og:image" content="${escapeHtml(image)}">\n        <meta name="twitter:image" content="${escapeHtml(image)}">`
        : '';
    const publishedMeta = published
        ? `<meta property="article:published_time" content="${escapeHtml(published)}">`
        : '';
    const structured = jsonLd
        ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="author" content="${escapeHtml(DEFAULT_AUTHOR)}">
    <meta name="robots" content="${escapeHtml(robots)}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="${escapeHtml(ogType)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    ${imageMeta}
    ${publishedMeta}
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <link rel="alternate" type="application/rss+xml" title="Reviews by ${escapeHtml(SITE_NAME)}" href="${SITE_ORIGIN}/reviews/feed.xml">
    ${structured}
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Island+Moments&family=Monsieur+La+Doulaise&family=Permanent+Marker&family=Quicksand:wght@300..700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${root}index.css">
    <link rel="stylesheet" href="${root}reviews.css">
</head>
<body>
    <header class="site-header">
        <input type="checkbox" id="hamburger" class="hamburger-checkbox">
        <label for="hamburger" class="hamburger" aria-label="Toggle menu">
            <span></span>
            <span></span>
            <span></span>
        </label>
        <nav class="main-nav">
            <ul class="nav-list">
                ${siteNav(depth)}
            </ul>
        </nav>
        <h1 class="hello-title">
            <a href="${root}index.html">HELLO!</a>
        </h1>
    </header>
    <main class="reviews-main">
${body}
    </main>
    <footer class="site-footer">
        <div class="footer-ticker" aria-hidden="true">
            <div class="ticker-track">
                <span>CYBERSECURITY</span><span>//</span>
                <span>CLOUD ARCHITECTURE</span><span>//</span>
                <span>FULL-STACK DEVELOPMENT</span><span>//</span>
                <span>U.S. NAVY VETERAN</span><span>//</span>
                <span>PRODUCT REVIEWS</span><span>//</span>
                <span>KUBERNETES</span><span>//</span>
                <span>ZERO TRUST</span><span>//</span>
                <span>GITOPS</span><span>//</span>
                <span>THREAT ANALYSIS</span><span>//</span>
                <span>RMF / ATO</span><span>//</span>
                <span>INCIDENT RESPONSE</span><span>//</span>
                <span>SAIPAN PROUD</span><span>//</span>
                <span>CYBERSECURITY</span><span>//</span>
                <span>CLOUD ARCHITECTURE</span><span>//</span>
                <span>FULL-STACK DEVELOPMENT</span><span>//</span>
                <span>U.S. NAVY VETERAN</span><span>//</span>
                <span>PRODUCT REVIEWS</span><span>//</span>
                <span>KUBERNETES</span><span>//</span>
                <span>ZERO TRUST</span><span>//</span>
                <span>GITOPS</span><span>//</span>
                <span>THREAT ANALYSIS</span><span>//</span>
                <span>RMF / ATO</span><span>//</span>
                <span>INCIDENT RESPONSE</span><span>//</span>
                <span>SAIPAN PROUD</span><span>//</span>
            </div>
        </div>
        <div class="footer-inner">
            <a href="#" class="back-to-top" aria-label="Back to top">
                <i class="fa-solid fa-circle-up" aria-hidden="true"></i>
            </a>
            <h2 class="hello-title"><a href="${root}index.html">HELLO!</a></h2>
            <p class="my-name">
                <span class="first-name">Christopher</span>
                <span class="last-name">Macabugao</span>
            </p>
            <div class="social-icons footer-socials">
                ${socialHtml()}
            </div>
            ${disclosureHtml()}
            <p class="copyright">&copy; ${new Date().getUTCFullYear()} Christopher Macabugao. All rights reserved.</p>
            <p class="reviews-rss"><a href="${root}reviews/feed.xml">Reviews RSS</a></p>
        </div>
    </footer>
    <script src="${root}main.js" defer></script>
</body>
</html>
`;
}

function thumbHtml(post, depth) {
    if (!post.image) {
        return '<div class="review-card-thumb review-card-thumb-empty">No photo yet</div>';
    }
    const alt = post.draft ? 'Example product photo placeholder' : post.productName;
    return `<img class="review-card-thumb" src="${escapeHtml(imageSrc(post.image, depth))}" alt="${escapeHtml(alt)}" loading="lazy">`;
}

function cardHtml(post, depth) {
    const href = post.draft ? `drafts/${post.slug}.html` : `${post.slug}.html`;
    const hrefFromHere = depth === 1 ? href : href.replace(/^drafts\//, '');
    const badge = post.draft ? '<span class="draft-badge">Draft example</span>' : '';
    return `<a class="review-card${post.draft ? ' is-draft' : ''}" href="${hrefFromHere}">
        ${thumbHtml(post, depth)}
        <span class="review-card-body">
            ${badge}
            <span class="review-card-meta">
                <span class="review-category">${escapeHtml(post.category)}</span>
                <time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>
            </span>
            <h2 class="review-card-title">${escapeHtml(post.title)}</h2>
            <span class="review-card-summary">${escapeHtml(post.summary)}</span>
            <span class="review-card-rating">${starsHtml(post.rating)} <span>${escapeHtml(formatRating(post.rating))}/5</span></span>
        </span>
    </a>`;
}

function publishedPosts(posts) {
    return posts.filter((post) => !post.draft).sort(comparePosts);
}

function draftPosts(posts) {
    return posts.filter((post) => post.draft).sort(comparePosts);
}

function renderListing(posts) {
    const published = publishedPosts(posts);
    const drafts = draftPosts(posts);
    const publishedHtml = published.length
        ? `<div class="review-grid">${published.map((post) => cardHtml(post, 1)).join('\n')}</div>`
        : '<p class="reviews-empty">No published reviews yet. A finished review appears here after you set draft to false.</p>';
    const draftsHtml = drafts.length
        ? `<section class="draft-section" aria-labelledby="draft-heading">
            <h2 id="draft-heading">Draft template</h2>
            <p>This entry is an example layout, not a real product review. It stays out of the sitemap and RSS feed.</p>
            <div class="review-grid">${drafts.map((post) => cardHtml(post, 1)).join('\n')}</div>
        </section>`
        : '';

    const itemList = published.length
        ? {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Product reviews',
            itemListOrder: 'https://schema.org/ItemListOrderDescending',
            numberOfItems: published.length,
            itemListElement: published.map((post, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                url: postUrl(post),
                name: post.title,
            })),
        }
        : null;

    const body = `        <header class="reviews-intro">
            <p class="reviews-kicker"><i class="fa-solid fa-terminal" aria-hidden="true"></i> PRODUCT_REVIEWS.LOG</p>
            <h1>Reviews</h1>
            <p class="reviews-lede">Honest notes on products I bought and used myself. Newest first.</p>
            ${disclosureHtml('review-disclosure')}
        </header>
        <section class="published-reviews" aria-label="Published reviews">
            ${publishedHtml}
        </section>
        ${draftsHtml}`;

    return chrome({
        depth: 1,
        title: `Reviews | ${SITE_NAME}`,
        description: 'Firsthand product reviews by Christopher Macabugao.',
        canonical: `${SITE_ORIGIN}/reviews/`,
        robots: 'index, follow',
        ogType: 'website',
        image: '',
        published: '',
        jsonLd: itemList,
        body,
    });
}

function reviewJsonLd(post) {
    const item = {
        '@type': 'Product',
        name: post.productName,
    };
    if (post.brand) item.brand = { '@type': 'Brand', name: post.brand };
    const image = absoluteImage(post.image);
    if (image) item.image = image;

    return {
        '@context': 'https://schema.org',
        '@type': 'Review',
        name: post.title,
        datePublished: post.date,
        reviewBody: plainText(post.body) || post.summary,
        author: { '@type': 'Person', name: post.author },
        reviewRating: {
            '@type': 'Rating',
            ratingValue: post.rating,
            bestRating: 5,
            worstRating: 0,
        },
        itemReviewed: item,
        publisher: { '@type': 'Person', name: SITE_NAME },
    };
}

function renderPost(post) {
    const depth = post.draft ? 2 : 1;
    const photo = post.image
        ? `<figure class="review-photo"><img src="${escapeHtml(imageSrc(post.image, depth))}" alt="${escapeHtml(post.draft ? 'Example product photo placeholder' : post.productName)}"></figure>`
        : '<figure class="review-photo review-photo-empty"><div>No product photo yet</div></figure>';
    const draftBanner = post.draft
        ? `<p class="draft-banner" role="status"><strong>Example draft.</strong> This is not a real product review and not a real rating. Replace this file with a firsthand review before you publish it.</p>`
        : '';
    const list = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;

    const body = `        <article class="review-article">
            ${draftBanner}
            <p class="reviews-kicker"><a href="${depth === 1 ? 'index.html' : '../index.html'}">Reviews</a> <span aria-hidden="true">/</span> ${escapeHtml(post.category)}</p>
            <h1>${escapeHtml(post.title)}</h1>
            <p class="review-byline">
                <time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>
                <span aria-hidden="true">·</span>
                <span>${escapeHtml(post.author)}</span>
            </p>
            ${disclosureHtml('review-disclosure')}
            <div class="review-top">
                ${photo}
                <aside class="verdict-card">
                    <p class="verdict-label">Quick verdict</p>
                    <p class="verdict-score">${starsHtml(post.rating)} <strong>${escapeHtml(formatRating(post.rating))}</strong><span>/5</span></p>
                    ${post.draft ? '<p class="rating-note">Placeholder score for the template.</p>' : ''}
                    <p class="verdict-text">${escapeHtml(post.verdict)}</p>
                    ${amazonButton(post.affiliateUrl)}
                    ${disclosureHtml('review-disclosure tight')}
                </aside>
            </div>
            <div class="pros-cons">
                <section class="pros">
                    <h2><i class="fa-solid fa-plus" aria-hidden="true"></i> Pros</h2>
                    ${list(post.pros)}
                </section>
                <section class="cons">
                    <h2><i class="fa-solid fa-minus" aria-hidden="true"></i> Cons</h2>
                    ${list(post.cons)}
                </section>
            </div>
            <div class="review-body">
                ${post.body ? markdownToHtml(post.body) : '<p>Write-up coming soon.</p>'}
            </div>
            <div class="review-end">
                ${amazonButton(post.affiliateUrl)}
                ${disclosureHtml('review-disclosure')}
                <p class="back-link"><a href="${depth === 1 ? 'index.html' : '../index.html'}"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> All reviews</a></p>
            </div>
        </article>`;

    return chrome({
        depth,
        title: `${post.title} | Reviews | ${SITE_NAME}`,
        description: post.description,
        canonical: postUrl(post),
        robots: post.draft ? 'noindex, nofollow' : 'index, follow',
        ogType: 'article',
        image: absoluteImage(post.image),
        published: post.date,
        jsonLd: post.draft ? null : reviewJsonLd(post),
        body,
    });
}

function renderSitemap(posts) {
    const urls = [
        { loc: `${SITE_ORIGIN}/`, lastmod: '' },
        { loc: `${SITE_ORIGIN}/about.html`, lastmod: '' },
        { loc: `${SITE_ORIGIN}/contact.html`, lastmod: '' },
        { loc: `${SITE_ORIGIN}/blog1.html`, lastmod: '' },
        { loc: `${SITE_ORIGIN}/myResume.html`, lastmod: '' },
        { loc: `${SITE_ORIGIN}/reviews/`, lastmod: '' },
    ];
    publishedPosts(posts).forEach((post) => {
        urls.push({ loc: postUrl(post), lastmod: post.updated || post.date });
    });

    const body = urls
        .map((url) => {
            const lastmod = url.lastmod ? `\n    <lastmod>${url.lastmod}</lastmod>` : '';
            return `  <url>\n    <loc>${escapeXml(url.loc)}</loc>${lastmod}\n  </url>`;
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function renderFeed(posts) {
    const items = publishedPosts(posts)
        .map((post) => {
            const [year, month, day] = post.date.split('-').map(Number);
            const pubDate = new Date(Date.UTC(year, month - 1, day)).toUTCString();
            return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl(post))}</link>
      <guid>${escapeXml(postUrl(post))}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(post.category)}</category>
      <description>${escapeXml(post.summary)}</description>
    </item>`;
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Reviews — ${escapeXml(SITE_NAME)}</title>
    <link>${SITE_ORIGIN}/reviews/</link>
    <description>Firsthand product reviews by Christopher Macabugao.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function cleanGenerated() {
    if (fs.existsSync(REVIEWS_DIR)) {
        for (const name of fs.readdirSync(REVIEWS_DIR)) {
            if (name.endsWith('.html') || name === 'feed.xml') {
                fs.unlinkSync(path.join(REVIEWS_DIR, name));
            }
        }
    }
    if (fs.existsSync(DRAFTS_DIR)) {
        for (const name of fs.readdirSync(DRAFTS_DIR)) {
            if (name.endsWith('.html')) fs.unlinkSync(path.join(DRAFTS_DIR, name));
        }
    }
}

function writeFile(filePath, contents) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
}

function build() {
    const posts = loadPosts();
    cleanGenerated();
    injectHomeLatest(posts);
    writeFile(path.join(REVIEWS_DIR, 'index.html'), renderListing(posts));
    writeFile(path.join(REVIEWS_DIR, 'feed.xml'), renderFeed(posts));
    writeFile(path.join(ROOT, 'sitemap.xml'), renderSitemap(posts));

    posts.forEach((post) => {
        const folder = post.draft ? DRAFTS_DIR : REVIEWS_DIR;
        writeFile(path.join(folder, `${post.slug}.html`), renderPost(post));
    });

    verifyOutput(posts);
    const published = posts.filter((post) => !post.draft).length;
    const drafts = posts.length - published;
    console.log(`Built ${published} published review(s) and ${drafts} draft(s).`);
}

function headerHtml(html) {
    const start = html.indexOf('<header');
    const end = html.indexOf('</header>');
    assert(start !== -1 && end > start, 'Page is missing a header.');
    return html.slice(start, end);
}

function assertSharedNav(html, label) {
    const header = headerHtml(html);
    assert(/\bnav-reviews\b/.test(header), `${label} is missing the Reviews accent link.`);
    assert(header.includes('>Home</a>'), `${label} is missing Home.`);
    assert(header.includes('>Reviews</a>'), `${label} is missing Reviews.`);
    assert(header.includes('>About</a>'), `${label} is missing About.`);
    assert(header.includes('>Contact</a>'), `${label} is missing Contact.`);
    assert(!header.includes('>Projects</a>') && !header.includes('projects.html'), `${label} nav still includes Projects.`);
    assert(!/href="[^"]*#(?:about|skills|future-dev|contact)"/.test(header), `${label} nav still points at a removed section.`);
    assert(!header.includes('blog1.html') && !header.includes('myResume.html'), `${label} nav should be Home, Reviews, About, and Contact.`);
}

function verifySharedNav() {
    ['index.html', 'about.html', 'contact.html', 'blog1.html', 'myResume.html'].forEach((file) => {
        const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
        assertSharedNav(html, file);
        assert(!html.includes('projects.html'), `${file} still links to Projects.`);
        assert(!/href="[^"]*#(?:about|skills|future-dev|contact)"/.test(html), `${file} still links to a removed section.`);
    });
}

function verifyHomeLatest(posts) {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const start = html.indexOf(LATEST_START);
    const end = html.indexOf(LATEST_END);
    assert(start !== -1 && end > start, 'index.html is missing the latest-reviews markers.');
    const block = html.slice(start, end);
    assert(block.includes('id="latest-reviews"'), 'Homepage strip is missing #latest-reviews.');
    assert(block.includes('>See all reviews</a>'), 'Homepage strip is missing the See all reviews link.');
    assert(block.includes('href="reviews/index.html"'), 'See all reviews should point at the reviews index.');
    assert(block.includes(DISCLOSURE), 'Homepage strip is missing the Amazon disclosure.');

    const latest = publishedPosts(posts).slice(0, 3);
    let cursor = -1;
    latest.forEach((post) => {
        const href = `href="reviews/${post.slug}.html"`;
        const at = block.indexOf(href);
        assert(at > cursor, `${post.slug} is missing or out of order on the homepage strip.`);
        cursor = at;
        assert(block.includes(escapeHtml(post.title)), `${post.slug} title is missing from the homepage strip.`);
        assert(block.includes(escapeHtml(post.summary)), `${post.slug} summary is missing from the homepage strip.`);
        assert(block.includes('out of 5 stars'), `${post.slug} star rating is missing from the homepage strip.`);
    });
    publishedPosts(posts).slice(3).forEach((post) => {
        assert(!block.includes(`reviews/${post.slug}.html`), `${post.slug} should not be on the homepage strip.`);
    });
    draftPosts(posts).forEach((post) => {
        assert(!block.includes(post.slug), 'Drafts must stay off the homepage strip.');
    });
}

function verifyOutput(posts) {
    const listing = fs.readFileSync(path.join(REVIEWS_DIR, 'index.html'), 'utf8');
    const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const feed = fs.readFileSync(path.join(REVIEWS_DIR, 'feed.xml'), 'utf8');
    assert(listing.includes(DISCLOSURE), 'Listing page is missing the Amazon disclosure.');
    assertSharedNav(listing, 'reviews/index.html');
    verifySharedNav();
    verifyHomeLatest(posts);
    ['about.html', 'contact.html'].forEach((page) => {
        assert(sitemap.includes(`${SITE_ORIGIN}/${page}`), `${page} is missing from the sitemap.`);
    });
    assert(!sitemap.includes(`${SITE_ORIGIN}/projects.html`), 'Removed Projects page is still in the sitemap.');

    let cursor = -1;
    publishedPosts(posts).forEach((post) => {
        const at = listing.indexOf(escapeHtml(post.title));
        assert(at > cursor, 'Published reviews are not newest-first.');
        cursor = at;
    });

    posts.forEach((post) => {
        const file = path.join(post.draft ? DRAFTS_DIR : REVIEWS_DIR, `${post.slug}.html`);
        const html = fs.readFileSync(file, 'utf8');
        assertSharedNav(html, post.slug);
        assert(html.includes(DISCLOSURE), `${post.slug} is missing the Amazon disclosure.`);
        assert(html.includes('rel="sponsored nofollow noopener"'), `${post.slug} affiliate link is missing rel.`);
        assert(html.includes('target="_blank"'), `${post.slug} affiliate link must open in a new tab.`);
        assert(html.includes('Check price on Amazon'), `${post.slug} is missing the Amazon button.`);
        assert(html.includes('<meta name="description"'), `${post.slug} is missing a meta description.`);
        assert(html.includes('property="og:title"'), `${post.slug} is missing Open Graph tags.`);

        if (post.draft) {
            assert(html.includes('noindex, nofollow'), `${post.slug} draft must be noindex.`);
            assert(!html.includes('application/ld+json'), `${post.slug} draft must not emit review structured data.`);
            assert(!sitemap.includes(post.slug), 'Drafts must stay out of the sitemap.');
            assert(!feed.includes(post.slug), 'Drafts must stay out of the RSS feed.');
        } else {
            assert(html.includes('"@type":"Review"'), `${post.slug} is missing Review structured data.`);
            assert(html.includes('"@type":"Product"'), `${post.slug} is missing Product structured data.`);
            assert(sitemap.includes(postUrl(post)), `${post.slug} is missing from the sitemap.`);
            assert(feed.includes(escapeXml(post.title)), `${post.slug} is missing from the RSS feed.`);
        }
    });
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function selfTest() {
    const older = {
        slug: 'older-thing',
        filename: 'older-thing.md',
        title: 'Older published review',
        date: '2026-01-02',
        updated: '',
        category: 'Tools',
        summary: 'Older summary.',
        description: 'Older description.',
        image: '',
        rating: 3,
        verdict: 'Fine.',
        pros: ['Solid'],
        cons: ['Heavy'],
        affiliateUrl: 'https://www.amazon.com/dp/B0EXAMPLE?tag=example-20',
        productName: 'Older Thing',
        brand: 'Example',
        draft: false,
        author: DEFAULT_AUTHOR,
        body: 'See the [price](https://www.amazon.com/dp/B0EXAMPLE?tag=example-20).',
    };
    const newer = { ...older, slug: 'newer-thing', title: 'Newer published review', date: '2026-05-04', summary: 'Newer summary.' };
    const sorted = [older, newer].sort(comparePosts);
    assert(sorted[0].slug === 'newer-thing', 'Newest post should sort first.');

    const page = renderPost(newer);
    assert(page.includes('rel="sponsored nofollow noopener"'), 'Self-test missed sponsored rel.');
    assert(page.includes('target="_blank"'), 'Self-test missed target blank.');
    assert(page.includes(DISCLOSURE), 'Self-test missed disclosure.');
    assert(page.includes('"@type":"Review"') && page.includes('"@type":"Product"'), 'Self-test missed JSON-LD.');
    assert(page.includes('<meta property="og:title"'), 'Self-test missed Open Graph.');
    assertSharedNav(page, 'review self-test');
    assert(page.includes('href="../about.html"'), 'Review About link should be its own page.');
    assert(!page.includes('projects.html'), 'Review nav should not include Projects.');
    assert(page.includes('href="index.html" class="nav-reviews nav-active"'), 'Reviews link should stay highlighted.');

    const draftNav = renderPost({ ...older, draft: true, slug: 'draft-thing' });
    assert(draftNav.includes('href="../../about.html"'), 'Draft nav should climb two levels.');
    assert(draftNav.includes('href="../index.html" class="nav-reviews nav-active"'), 'Draft Reviews link is wrong.');

    const bodyLink = markdownToHtml(older.body);
    assert(bodyLink.includes('rel="sponsored nofollow noopener"'), 'Amazon links in the write-up need the sponsored rel.');

    const draft = renderPost({ ...older, draft: true, slug: 'draft-thing' });
    assert(draft.includes('noindex, nofollow'), 'Draft self-test should noindex.');
    assert(!draft.includes('application/ld+json'), 'Draft self-test should skip JSON-LD.');

    const listing = renderListing([older, newer]);
    const newerAt = listing.indexOf('Newer published review');
    const olderAt = listing.indexOf('Older published review');
    assert(newerAt !== -1 && olderAt !== -1 && newerAt < olderAt, 'Listing should be newest-first.');

    const middle = { ...older, slug: 'middle-thing', title: 'Middle published review', date: '2026-03-03', summary: 'Middle summary.', image: 'images/mic.jpg' };
    const ancient = { ...older, slug: 'ancient-thing', title: 'Ancient published review', date: '2025-01-01', summary: 'Ancient summary.' };
    const draftPost = { ...older, slug: 'draft-thing', title: 'Draft review', date: '2026-06-06', draft: true, summary: 'Draft summary.' };
    const home = renderHomeLatest([older, newer, middle, ancient, draftPost]);
    assert(home.indexOf('reviews/newer-thing.html') < home.indexOf('reviews/middle-thing.html'), 'Homepage should list the newest review first.');
    assert(home.indexOf('reviews/middle-thing.html') < home.indexOf('reviews/older-thing.html'), 'Homepage should keep date order.');
    assert(!home.includes('ancient-thing'), 'Homepage strip should show only the three newest reviews.');
    assert(!home.includes('draft-thing'), 'Homepage strip should skip drafts.');
    assert(home.includes('src="reviews/images/mic.jpg"'), 'Homepage image path should be relative to the site root.');
    assert(home.includes('>See all reviews</a>'), 'Homepage strip needs the see-all link.');
    assert(home.includes('out of 5 stars'), 'Homepage strip needs star ratings.');
    assert(home.includes(DISCLOSURE), 'Homepage strip needs the Amazon disclosure.');

    console.log('Review build self-test passed.');
}

if (require.main === module) {
    if (process.argv.includes('--self-test')) {
        selfTest();
    } else {
        build();
    }
}

module.exports = {
    loadPosts,
    comparePosts,
    markdownToHtml,
    renderPost,
    renderListing,
    renderHomeLatest,
    DISCLOSURE,
};
