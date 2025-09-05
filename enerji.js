// Enerji verimliliği ve sürdürülebilirlik raporu — geliştirilmiş ve simülasyon destekli
// Fonksiyonlar:
// - enerjiRaporu({ enerji }): mevcut enerji verisi ile özet rapor döndürür
// - simulateEnerji({ seed, tur }): aylık zaman serisi ve özet üreten basit simülasyon

function enerjiRaporu({ enerji }) {
  let tuketim = enerji && enerji.tuketim ? Number(enerji.tuketim) : 0;
  let birim = enerji && enerji.birim ? enerji.birim : 'kWh/ay';

  // Daha gerçekçi bir skorlama: tüketim yoğunluğu ve birim üzerinden normalize
  let verimlilik = 100 - Math.min(90, Math.round((tuketim / (birim.includes('yıl') ? 12 : 1)) / 25));
  if (verimlilik < 0) verimlilik = 0;

  let surdurulebilirlik = Math.min(100, verimlilik + 8);

  return {
    tuketim,
    birim,
    verimlilik,
    surdurulebilirlik,
    yorum: verimlilik > 80 ? 'Çok iyi' : verimlilik > 60 ? 'İyi' : verimlilik > 40 ? 'Geliştirilmeli' : 'Yüksek tüketim — iyileştirme gerekli'
  };
}

// Basit aylık enerji tüketim simülasyonu
function simulateEnerji({ seed = 1, tur = 'Konut' } = {}) {
  // seed ile deterministik ama basit rasgelelik
  const rand = (x) => {
    const s = Math.sin(x * 9301 + seed * 49297) * 43758.5453;
    return s - Math.floor(s);
  };

  // Temel ortalama değer türlere göre
  const base = tur === 'Konut' ? 600 : tur === 'Ticari' ? 1500 : 400;
  const months = [];
  for (let m = 0; m < 12; m++) {
    // mevsimsel etki: kış aylarında ısıtma -> daha yüksek tüketim
    const season = Math.cos((m / 12) * Math.PI * 2) * 0.15; // -0.15..+0.15
    const noise = (rand(m + 1) - 0.5) * 0.2;
    const val = Math.max(0, Math.round(base * (1 + season + noise) + (rand(m + 10) * 200 - 100)));
    months.push(val);
  }
  const avg = Math.round(months.reduce((a,b)=>a+b,0)/months.length);
  const peak = Math.max(...months);
  const summary = enerjiRaporu({ enerji: { tuketim: avg, birim: 'kWh/ay' } });

  return { months, avg, peak, summary };
}

module.exports = { enerjiRaporu, simulateEnerji };
