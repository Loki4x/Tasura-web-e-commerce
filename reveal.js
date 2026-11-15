// ====== Animasi muncul saat di-scroll ======
// Elemen bergeser naik sambil memudar ketika masuk layar. Kartu yang berjajar muncul bergantian.
// Konten tetap terlihat bila JavaScript mati atau pengguna memilih "kurangi animasi".
(() => {
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const SELECTOR = [
    ".hero-split", ".hero-stage", ".proof-row li",
    ".chapter-head", ".section-head", ".categories",
    ".pcard", "#productGrid .card", ".bento > .stage", ".triptych > .stage",
    ".track li", ".quotes figure", ".faq-head", ".faq details",
    ".closing h2", ".closing .pill-row", ".footer-grid > *",
    ".page-hero .container", ".builder-hero .container",
    ".preset", ".slots-head", ".track-card", ".action-box",
    ".gallery", ".pd-info", ".pd-section", ".rel-card", ".cmp-table, .cmp-grid",
  ].join(",");
  document.documentElement.classList.add("reveal-on");

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

  const t0 = performance.now(); // konten yang dimuat di awal (dari database) tetap dianimasikan
  const onScreen = el => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };
  function watch(root = document, later = false) {
    const els = [...root.querySelectorAll(SELECTOR)];
    if (root !== document && root.matches?.(SELECTOR)) els.unshift(root);
    els.forEach(el => {
      if (el.dataset.reveal || el.closest(".modal, .drawer")) return;
      el.dataset.reveal = "1";
      // Elemen yang digambar ulang saat sudah terlihat (filter, bandingkan) tidak dianimasikan lagi
      if (later && performance.now() - t0 > 2500 && onScreen(el)) return;
      // Jeda bertahap untuk elemen bersaudara (kartu dalam satu baris)
      const sibs = [...el.parentElement.children].filter(c => c.matches(SELECTOR));
      const i = sibs.indexOf(el);
      el.style.setProperty("--rd", `${Math.min(i % 4, 3) * 80}ms`);
      el.classList.add("reveal");
      // Yang sudah di layar saat halaman dibuka langsung muncul (tetap beranimasi)
      io.observe(el);
    });
  }

  const start = () => {
    watch();
    // Produk dimuat belakangan dari database: pantau elemen yang ditambahkan
    new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && watch(n, true))))
      .observe(document.body, { childList: true, subtree: true });
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();
