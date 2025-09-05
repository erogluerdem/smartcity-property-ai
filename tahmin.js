// Basit taşınmaz değer tahmini fonksiyonu
// Gerçek bir makine öğrenmesi yerine örnek bir matematiksel model kullanılır
// İleride Python veya gerçek ML entegrasyonu eklenebilir

// Daha gelişmiş (basit) tahmin: ensemble yaklaşımı
function tahminiDeger({ konum, tur, deger, kullanim, enerji }) {
  const base = Number(deger) || 1000000;
  const enerjiTuketim = (enerji && Number(enerji.tuketim)) || 0;

  // Model A: basit lineer
  const mA = base + enerjiTuketim * 1.8;

  // Model B: konuma göre çarpan
  let locFactor = 1;
  if ((konum || '').toLowerCase().includes('istanbul')) locFactor = 1.25;
  if ((konum || '').toLowerCase().includes('ankara')) locFactor = 1.12;
  const mB = base * locFactor + (tur === 'Ticari' ? 400000 : 0);

  // Model C: kullanım ve sezon etkisi (örnek)
  const usageFactor = (kullanim === 'Ofis') ? 1.08 : 1;
  const seasonFactor = 1 + (Math.random() - 0.5) * 0.04; // küçük rastgele etki
  const mC = base * usageFactor * seasonFactor;

  // Ensemble: ağırlıklı ortalama
  const tahmin = Math.round((mA * 0.35) + (mB * 0.45) + (mC * 0.20));
  return tahmin;
}

module.exports = tahminiDeger;
