/**
 * Christopher Macabugao — Portfolio JavaScript
 * main.js  |  All interactive enhancements
 */
'use strict';

/* ─────────────────────────────────────────
   UTILITIES
───────────────────────────────────────── */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const isTouchOnly = () => !window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ═══════════════════════════════════════════
   1. CUSTOM CURSOR  (desktop only)
═══════════════════════════════════════════ */
function initCursor() {
    if (isTouchOnly()) return;

    const ring = document.createElement('div');
    const dot  = document.createElement('div');
    ring.className = 'cursor-ring';
    dot.className  = 'cursor-dot';
    document.body.append(ring, dot);

    let mx = -300, my = -300, cx = -300, cy = -300;

    document.addEventListener('mousemove', e => {
        mx = e.clientX;
        my = e.clientY;
        dot.style.left = mx + 'px';
        dot.style.top  = my + 'px';
    });

    document.addEventListener('mouseleave', () => { mx = my = cx = cy = -300; });

    (function loop() {
        cx += (mx - cx) * 0.13;
        cy += (my - cy) * 0.13;
        ring.style.left = cx + 'px';
        ring.style.top  = cy + 'px';
        requestAnimationFrame(loop);
    })();

    // Expand ring on interactive elements
    const HOVER_SEL = 'a, button, .card, .orbit-img, input, textarea, label';
    document.addEventListener('mouseover', e => {
        if (e.target.closest(HOVER_SEL)) ring.classList.add('big');
    });
    document.addEventListener('mouseout', e => {
        if (e.target.closest(HOVER_SEL)) ring.classList.remove('big');
    });
}

/* ═══════════════════════════════════════════
   2. PARTICLE / NETWORK CANVAS  (hero bg)
═══════════════════════════════════════════ */
function initParticles() {
    const hero = $('.welcome-section');
    if (!hero) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'particle-canvas';
    hero.prepend(canvas);
    const ctx = canvas.getContext('2d');

    const COUNT   = window.innerWidth < 768 ? 45 : 85;
    const MAX_D   = 140;
    const SPEED   = 0.55;
    const C       = '71,182,228';     // cyan rgb
    const ACCENT  = '255,71,87';      // red rgb (occasional node)

    let W, H;
    const mouse = { x: null, y: null };
    let particles = [];

    function resize() {
        W = canvas.width  = hero.offsetWidth;
        H = canvas.height = hero.offsetHeight;
    }

    class Particle {
        constructor() { this.init(true); }

        init(rand = false) {
            this.x  = rand ? Math.random() * W : (Math.random() < 0.5 ? -5 : W + 5);
            this.y  = rand ? Math.random() * H : Math.random() * H;
            this.vx = (Math.random() - 0.5) * SPEED;
            this.vy = (Math.random() - 0.5) * SPEED;
            this.r  = Math.random() * 2 + 1;
            this.a  = Math.random() * 0.5 + 0.25;
            // ~10 % of nodes are accent-colored "threat nodes"
            this.accent = Math.random() < 0.1;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < -15 || this.x > W + 15 || this.y < -15 || this.y > H + 15) this.init();

            // Mouse repulsion
            if (mouse.x !== null) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const d  = Math.hypot(dx, dy);
                if (d < 110) {
                    const f = (110 - d) / 110;
                    this.x += (dx / d) * f * 2.5;
                    this.y += (dy / d) * f * 2.5;
                }
            }
        }

        draw() {
            const color = this.accent ? ACCENT : C;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color},${this.a})`;
            ctx.fill();

            // Glow on accent nodes
            if (this.accent) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r + 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${ACCENT},0.08)`;
                ctx.fill();
            }
        }
    }

    function drawLines() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const d  = Math.hypot(dx, dy);
                if (d < MAX_D) {
                    const a = (1 - d / MAX_D) * 0.3;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(${C},${a})`;
                    ctx.lineWidth = 0.7;
                    ctx.stroke();
                }
            }
        }
    }

    function tick() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p => { p.update(); p.draw(); });
        drawLines();
        requestAnimationFrame(tick);
    }

    function build() {
        particles = Array.from({ length: COUNT }, () => new Particle());
    }

    hero.addEventListener('mousemove', e => {
        const r = hero.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
    });
    hero.addEventListener('mouseleave', () => { mouse.x = mouse.y = null; });
    window.addEventListener('resize', () => { resize(); build(); }, { passive: true });

    resize(); build(); tick();
}

/* ═══════════════════════════════════════════
   3. TYPEWRITER — role cycling in tagline
═══════════════════════════════════════════ */
function initTypewriter() {
    const el = $('.welcome-tagline');
    if (!el) return;

    const LINES = [
        'Future Full-Stack Developer',
        'Cloud & Cybersecurity Professional',
        'U.S. Navy & Air National Guard Veteran',
        'IT Infrastructure Architect',
        'Motorcycle Enthusiast & Family Man',
    ];

    let si = 0, ci = 0, deleting = false;

    function tick() {
        const str = LINES[si];
        el.textContent = deleting ? str.slice(0, --ci) : str.slice(0, ++ci);

        let wait = deleting ? 32 : 72;

        if (!deleting && ci === str.length) { deleting = true; wait = 2300; }
        else if (deleting && ci === 0)      { deleting = false; si = (si + 1) % LINES.length; wait = 400; }

        setTimeout(tick, wait);
    }

    el.textContent = '';
    setTimeout(tick, 800); // slight start delay for drama
}

/* ═══════════════════════════════════════════
   4. GLITCH EFFECT — hero title
═══════════════════════════════════════════ */
function initGlitch() {
    const el = $('.welcome-title');
    if (!el) return;

    const orig  = el.textContent;
    const CHARS = '!@#$%<>/\\|[]{}~`ABCDEFabcdef0123456789';

    function glitch() {
        let step = 0;
        const total = orig.length;
        const iv = setInterval(() => {
            el.textContent = orig.split('').map((ch, i) => {
                if (i < step || ch === ' ') return ch;
                return CHARS[Math.floor(Math.random() * CHARS.length)];
            }).join('');
            step += 1.8;
            if (step >= total) { clearInterval(iv); el.textContent = orig; }
        }, 30);
    }

    el.addEventListener('mouseenter', glitch);
    setInterval(glitch, 9000); // auto-glitch every 9 s
}

/* ═══════════════════════════════════════════
   5. SCROLL PROGRESS BAR
═══════════════════════════════════════════ */
function initScrollBar() {
    const bar = document.createElement('div');
    bar.id = 'scroll-progress';
    document.body.append(bar);

    window.addEventListener('scroll', () => {
        const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100;
        bar.style.width = Math.min(pct, 100) + '%';
    }, { passive: true });
}

/* ═══════════════════════════════════════════
   6. SCROLL REVEAL  (IntersectionObserver)
═══════════════════════════════════════════ */
function initReveal() {
    // Turn off the old CSS load-time animations for off-screen sections
    const kill = document.createElement('style');
    kill.textContent = `
        #about .about-container,
        #skills .skill-row, #skills .skill-row.reverse,
        #future-dev .future-title, #future-dev .bento-grid,
        #contact .contact-container { animation: none !important; }
    `;
    document.head.append(kill);

    // Map of selector → animation direction
    const GROUPS = [
        { sel: '#about .section-title',   dir: 'up' },
        { sel: '.about-text',             dir: 'up' },
        { sel: '.orbit-img',              dir: 'up',   stagger: 90 },
        { sel: '.skill-row:not(.reverse)',dir: 'left' },
        { sel: '.skill-row.reverse',      dir: 'right' },
        { sel: '#skills .section-title',  dir: 'up' },
        { sel: '.future-title',           dir: 'up' },
        { sel: '.bento-grid',             dir: 'up' },
        { sel: '.contact-container',      dir: 'up' },
    ];

    const observer = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            const delay = parseInt(e.target.dataset.rvDelay || '0', 10);
            setTimeout(() => e.target.classList.add('rv-show'), delay);
            observer.unobserve(e.target);
        });
    }, { threshold: 0.07, rootMargin: '0px 0px -30px 0px' });

    const seen = new Set();
    GROUPS.forEach(({ sel, dir, stagger = 0 }) => {
        $$(sel).forEach((el, idx) => {
            if (seen.has(el)) return;
            seen.add(el);
            el.classList.add('rv', `rv-${dir}`);
            if (stagger) el.dataset.rvDelay = idx * stagger;
            observer.observe(el);
        });
    });
}

/* ═══════════════════════════════════════════
   7. ACTIVE NAV SECTION TRACKING
═══════════════════════════════════════════ */
function initActiveNav() {
    const sections = $$('section[id]');
    const links    = $$('.nav-list a[href^="#"]');
    if (!sections.length || !links.length) return;

    const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            links.forEach(l => l.classList.remove('nav-active'));
            const lnk = $(`.nav-list a[href="#${e.target.id}"]`);
            if (lnk) lnk.classList.add('nav-active');
        });
    }, { threshold: 0.35 });

    sections.forEach(s => io.observe(s));
}

/* ═══════════════════════════════════════════
   8. 3-D CARD TILT  (desktop only)
═══════════════════════════════════════════ */
function initTilt() {
    if (isTouchOnly()) return;

    $$('.skill-image .card').forEach(card => {
        let raf;

        card.addEventListener('mousemove', e => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const r  = card.getBoundingClientRect();
                const px = (e.clientX - r.left)  / r.width  - 0.5;  // -0.5 … 0.5
                const py = (e.clientY - r.top)    / r.height - 0.5;
                card.style.transform =
                    `perspective(900px) rotateY(${px * 14}deg) rotateX(${-py * 14}deg) scale3d(1.04,1.04,1.04)`;
            });
        });

        card.addEventListener('mouseleave', () => {
            cancelAnimationFrame(raf);
            card.style.transition = 'transform 0.55s ease';
            card.style.transform  = '';
            setTimeout(() => (card.style.transition = ''), 550);
        });
    });
}

/* ═══════════════════════════════════════════
   9. CLICK-TO-FLIP  (touch / mobile)
═══════════════════════════════════════════ */
function initClickFlip() {
    $$('.card').forEach(card => {
        card.addEventListener('click', () => {
            if (isTouchOnly()) card.classList.toggle('touch-flipped');
        });
    });
}

/* ═══════════════════════════════════════════
   10. BACK-TO-TOP VISIBILITY
═══════════════════════════════════════════ */
function initBackToTop() {
    const btn = $('.back-to-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
        btn.classList.toggle('btt-visible', window.scrollY > 450);
    }, { passive: true });

    btn.addEventListener('click', e => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/* ═══════════════════════════════════════════
   11. HAMBURGER — close on nav-link click
═══════════════════════════════════════════ */
function initHamburger() {
    const cb = $('#hamburger');
    if (!cb) return;
    $$('.nav-list a').forEach(a => a.addEventListener('click', () => (cb.checked = false)));
}

/* ═══════════════════════════════════════════
   12. FLOATING ORBIT PHOTOS  (about section)
═══════════════════════════════════════════ */
function initOrbitFloat() {
    $$('.orbit-img').forEach((img, i) => {
        // Read the current rotation from computed style so we preserve it
        const mat = new DOMMatrix(getComputedStyle(img).transform);
        const rot = Math.atan2(mat.b, mat.a) * (180 / Math.PI);

        img.style.setProperty('--base-rot',    `${rot}deg`);
        img.style.setProperty('--float-dur',   `${3 + (i % 4) * 0.6}s`);
        img.style.setProperty('--float-delay', `${i * 0.3}s`);
        img.classList.add('orbit-float');
    });
}

/* ═══════════════════════════════════════════
   13. MAGNETIC SOCIAL ICONS
═══════════════════════════════════════════ */
function initMagnetic() {
    if (isTouchOnly()) return;

    $$('.social-icons a, .contact-social-icons a, .scroll-down').forEach(el => {
        el.addEventListener('mousemove', e => {
            const r  = el.getBoundingClientRect();
            const cx = r.left + r.width  / 2;
            const cy = r.top  + r.height / 2;
            const dx = (e.clientX - cx) * 0.28;
            const dy = (e.clientY - cy) * 0.28;
            el.style.transform = `translate(${dx}px, ${dy}px) translateY(-5px)`;
        });
        el.addEventListener('mouseleave', () => (el.style.transform = ''));
    });
}

/* ═══════════════════════════════════════════
   14. FORM TOAST NOTIFICATION
═══════════════════════════════════════════ */
function initFormToast() {
    const form = $('form');
    if (!form) return;

    form.addEventListener('submit', () => {
        const toast = document.createElement('div');
        toast.className   = 'toast-msg';
        toast.innerHTML   = '<i class="fa-regular fa-envelope"></i> Message incoming! Talk soon!';
        document.body.append(toast);
        // allow paint before adding transition class
        requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('toast-show')));
        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => toast.remove(), 450);
        }, 3500);
    });
}

/* ═══════════════════════════════════════════
   15. HEADER GLASS EFFECT ON SCROLL
═══════════════════════════════════════════ */
function initHeaderScroll() {
    const header = $('.site-header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        header.classList.toggle('header-scrolled', window.scrollY > 60);
    }, { passive: true });
}

/* ═══════════════════════════════════════════
   16. PROGRESS BARS — also scroll-triggered
═══════════════════════════════════════════ */
function initProgressBars() {
    const BARS = [
        { sel: '.bootcamp-progress-fill',  w: '17%' },
        { sel: '.mactrack-progress-fill',  w: '90%' },
        { sel: '.dashboard-progress-fill', w: '10%' },
        { sel: '.rmf-progress-fill',       w: '30%' },
    ];

    BARS.forEach(({ sel, w }) => {
        const fill = $(sel);
        if (!fill) return;

        const card = fill.closest('.card');
        if (!card) return;

        let triggered = false;

        // Trigger on hover (already in CSS) + on viewport entry
        const io = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !triggered) {
                triggered = true;
                // Auto-flip to show back after a moment, then fill bar
                setTimeout(() => {
                    card.classList.add('auto-reveal');
                    fill.style.width = w;
                }, 600);
                io.disconnect();
            }
        }, { threshold: 0.6 });

        io.observe(card);
    });
}

/* ═══════════════════════════════════════════
   17. ORBIT CAROUSEL  (projects section)
═══════════════════════════════════════════ */
function initOrbitCarousel() {
    const track = $('#orbitTrack');
    if (!track) return;

    const items = $$('.orbit-item', track);
    const N = items.length;
    if (!N) return;

    const ANGLE = 360 / N;
    let current = 0;
    let autoTimer;

    function getRadius() {
        return parseInt(getComputedStyle(track.parentElement).getPropertyValue('--orbit-r')) || 500;
    }

    function positionCards() {
        const R = getRadius();
        items.forEach((item, i) => {
            item.style.transform = `rotateY(${i * ANGLE}deg) translateZ(${R}px)`;
        });
    }

    function rotateTo(index) {
        current = ((index % N) + N) % N;
        track.style.transform = `rotateY(${-current * ANGLE}deg)`;
        items.forEach((item, i) => item.classList.toggle('active', i === current));
    }

    positionCards();
    rotateTo(0);

    window.addEventListener('resize', positionCards, { passive: true });

    const prevBtn = $('.orbit-prev');
    const nextBtn = $('.orbit-next');
    if (prevBtn) prevBtn.addEventListener('click', () => rotateTo(current - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => rotateTo(current + 1));

    // Click a non-active card to bring it to front
    items.forEach((item, i) => {
        item.addEventListener('click', e => {
            if (i !== current) {
                e.stopPropagation();
                rotateTo(i);
            }
        });
    });
}

/* ═══════════════════════════════════════════
   BOOT — init everything on DOM ready
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    initCursor();
    initParticles();
    initTypewriter();
    initGlitch();
    initScrollBar();
    initReveal();
    initActiveNav();
    initTilt();
    initClickFlip();
    initBackToTop();
    initHamburger();
    initOrbitFloat();
    initMagnetic();
    initFormToast();
    initHeaderScroll();
    // initProgressBars(); // currently triggered by CSS hover — enable if desired
});
