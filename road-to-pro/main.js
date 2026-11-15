// Scroll behaviour for the athlete site: day counter, word reveal, fade-ins, story, gallery drag.
(function () {
  // Hero number: days since padel became Vitto's game. Day 1 is 14 February 2026.
  const DAY_ONE = new Date(2026, 1, 14);   // Valentine's Day 2026
  const day = document.getElementById('day');
  if (day) day.textContent = Math.max(1, Math.floor((Date.now() - DAY_ONE.getTime()) / 86400000) + 1);

  // Split [data-split] text into masked words so they can slide up one by one.
  let i = 0;
  function split(node) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/\s+/).filter(Boolean).forEach((word) => {
          const w = document.createElement('span');
          w.className = 'w';
          const wi = document.createElement('span');
          wi.className = 'wi';
          wi.style.transitionDelay = i++ * 22 + 'ms';
          wi.textContent = word;
          w.appendChild(wi);
          frag.appendChild(w);
          frag.appendChild(document.createTextNode(' '));
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) {
        split(child);
      }
    });
  }
  document.querySelectorAll('[data-split]').forEach((el) => {
    el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
    i = 0;
    split(el);
  });

  // Fade/slide in on entering the viewport.
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }),
    { threshold: 0.2 }
  );
  document.querySelectorAll('.reveal,[data-split]').forEach((el) => io.observe(el));

  // Story: photos scroll up the middle; the one crossing the centre is active.
  // Its title and date show on the left, its text on the right.
  const figs = [...document.querySelectorAll('.saga-track figure')];
  const title = document.getElementById('saga-title');
  const date = document.getElementById('saga-date');
  const text = document.getElementById('saga-text');
  const list = document.getElementById('saga-list');
  const count = document.getElementById('saga-count');
  let current = -1;
  function show(n) {
    if (n === current) return;
    current = n;
    const cap = figs[n].querySelector('.saga-cap');
    figs.forEach((f, k) => f.classList.toggle('on', k === n));
    [...list.children].forEach((li, k) => li.classList.toggle('on', k === n));
    [title, date, text].forEach((el) => el.classList.remove('show'));
    void title.offsetWidth;                       // restart the swap animation
    title.textContent = cap.querySelector('h3').textContent;
    date.textContent = cap.querySelector('.d').textContent;
    text.innerHTML = cap.querySelector('.t').innerHTML;
    count.textContent = String(n + 1).padStart(2, '0') + ' / ' + String(figs.length).padStart(2, '0');
    [title, date, text].forEach((el) => el.classList.add('show'));
  }
  if (figs.length && title) {
    figs.forEach((f, n) => {
      const li = document.createElement('li');
      li.innerHTML = '<span>' + f.querySelector('.d').textContent + '</span>' + f.querySelector('h3').textContent;
      li.addEventListener('click', () => f.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      list.appendChild(li);
    });
    show(0);
    const so = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) show(figs.indexOf(e.target)); }),
      { rootMargin: '-49% 0px -49% 0px' }
    );
    figs.forEach((f) => so.observe(f));
  }

  // Gallery: drag sideways with the mouse.
  const strip = document.querySelector('.strip');
  if (strip) {
    let down = false, startX = 0, startL = 0;
    strip.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; startX = e.clientX; startL = strip.scrollLeft; });
    window.addEventListener('pointermove', (e) => { if (down) strip.scrollLeft = startL - (e.clientX - startX); });
    window.addEventListener('pointerup', () => { down = false; });
    strip.addEventListener('dragstart', (e) => e.preventDefault());
  }
})();
