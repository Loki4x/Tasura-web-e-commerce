// ====== Pemilih titik lokasi (Leaflet + OpenStreetMap, gratis tanpa API key) ======
const MapPicker = (() => {
  const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist/";
  const NOMINATIM = "https://nominatim.openstreetmap.org/";
  let map = null, marker = null, onChange = () => {}, value = null, geoTimer;

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = LEAFLET + "leaflet.css";
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src = LEAFLET + "leaflet.js";
      js.onload = resolve; js.onerror = () => reject(new Error("Peta gagal dimuat. Periksa koneksi internet."));
      document.head.appendChild(js);
    });
  }

  async function mount(el, initial, cb) {
    onChange = cb || onChange;
    await loadLeaflet();
    if (!map) {
      map = L.map(el, { scrollWheelZoom: false }).setView(initial ? [initial.lat, initial.lng] : [-2.5, 117.5], initial ? 17 : 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", e => set(e.latlng.lat, e.latlng.lng));
    }
    setTimeout(() => map.invalidateSize(), 50);
    if (initial) set(initial.lat, initial.lng, true);
  }

  function set(lat, lng, pan) {
    lat = Math.round(lat * 1e6) / 1e6; lng = Math.round(lng * 1e6) / 1e6;
    value = { lat, lng, alamat: "" };
    if (!marker) {
      marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on("dragend", () => { const p = marker.getLatLng(); set(p.lat, p.lng); });
    } else marker.setLatLng([lat, lng]);
    if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 17));
    onChange(value);
    // alamat perkiraan (reverse geocoding), dibatasi agar tidak membanjiri server
    clearTimeout(geoTimer);
    geoTimer = setTimeout(async () => {
      try {
        const r = await fetch(`${NOMINATIM}reverse?format=jsonv2&addressdetails=1&accept-language=id&zoom=18&lat=${lat}&lon=${lng}`);
        const d = await r.json();
        if (value && value.lat === lat && value.lng === lng) { value.alamat = formatAddress(d.address, d.display_name); onChange(value); }
      } catch { /* alamat perkiraan opsional */ }
    }, 700);
  }

  // Susun alamat gaya Indonesia: Jalan No., Kel., Kec., Kota, Provinsi Kode Pos
  function formatAddress(a, fallback = "") {
    if (!a) return String(fallback).replace(/,\s*Indonesia$/i, "");
    const road = a.road || a.pedestrian || a.residential || a.footway || a.path;
    const pre = (label, v) => !v ? "" : new RegExp(`^(${label}|kelurahan|desa|kecamatan)\\b`, "i").test(v) ? v : `${label} ${v}`;
    const parts = [
      a.amenity || a.building || a.shop || a.office || "",
      road ? road + (a.house_number ? ` No. ${a.house_number}` : "") : "",
      a.neighbourhood || a.hamlet || a.quarter || "",
      pre("Kel.", a.village || a.suburb),
      pre("Kec.", a.city_district || a.district || a.municipality),
      (a.city || a.town || a.county || a.regency || "").toLowerCase() === String(a.state || a.province || "").toLowerCase() ? "" : (a.city || a.town || a.county || a.regency || ""),
      [a.state || a.province, a.postcode].filter(Boolean).join(" "),
    ].map(x => String(x).trim()).filter(Boolean);
    const seen = new Set();
    const uniq = parts.filter(x => { const k = x.toLowerCase().replace(/^(kel\.|kec\.)\s*/, ""); if (seen.has(k)) return false; seen.add(k); return true; });
    return uniq.length >= 2 ? uniq.join(", ") : String(fallback).replace(/,\s*Indonesia$/i, "");
  }

  async function search(q) {
    const r = await fetch(`${NOMINATIM}search?format=jsonv2&accept-language=id&countrycodes=id&limit=1&q=${encodeURIComponent(q)}`);
    const d = await r.json();
    if (!d.length) throw new Error("Lokasi tidak ditemukan. Coba kata kunci lain.");
    set(+d[0].lat, +d[0].lon, true);
  }

  function myLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Browser tidak mendukung lokasi."));
      navigator.geolocation.getCurrentPosition(
        p => { set(p.coords.latitude, p.coords.longitude, true); resolve(); },
        () => reject(new Error("Izin lokasi ditolak. Pilih titik secara manual di peta.")),
        { enableHighAccuracy: true, timeout: 15000 });
    });
  }

  function clear() { value = null; if (marker) { map.removeLayer(marker); marker = null; } onChange(null); }
  const gmaps = v => `https://www.google.com/maps?q=${v.lat},${v.lng}`;
  return { mount, set, search, myLocation, clear, gmaps, formatAddress, get value() { return value; } };
})();
