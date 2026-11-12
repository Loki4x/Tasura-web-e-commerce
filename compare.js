// ====== Bandingkan produk (maks. 3, disimpan di browser) ======
const Compare = (() => {
  const KEY = "tasura_compare", MAX = 3;
  const list = () => JSON.parse(localStorage.getItem(KEY) || "[]");
  const save = l => { localStorage.setItem(KEY, JSON.stringify(l)); renderBar(); document.dispatchEvent(new CustomEvent("compare:change")); };
  const has = id => list().includes(id);
  function toggle(id, kategori) {
    let l = list();
    if (l.includes(id)) { save(l.filter(x => x !== id)); return "removed"; }
    if (l.length >= MAX) return "full";
    l.push(id); save(l);
    return "added";
  }
  function renderBar() {
    const bar = document.getElementById("compareBar"); if (!bar) return;
    const n = list().length;
    bar.hidden = n === 0;
    bar.innerHTML = `⇄ Bandingkan <b>${n}</b> produk <span>Lihat →</span>`;
  }
  const clear = () => save([]);
  document.addEventListener("DOMContentLoaded", renderBar);
  return { list, has, toggle, clear, renderBar, MAX };
})();
