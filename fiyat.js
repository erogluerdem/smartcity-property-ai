// Dinamik fiyat önerisi için basit bir algoritma
// Bölge, tür, enerji ve piyasa koşullarına göre fiyat önerisi

function fiyatOnerisi({ konum, tur, deger, enerji }) {
  let bazFiyat = deger || 1000000;
  let katsayi = 1;

  // Bölgeye göre katsayı
  if (konum === 'İstanbul') katsayi = 1.3;
  else if (konum === 'Ankara') katsayi = 1.15;
  else katsayi = 1;

  // Tür etkisi
  if (tur === 'Ticari') bazFiyat += 400000;
  if (tur === 'Konut') bazFiyat += 200000;

  // Enerji verimliliği düşükse fiyatı azalt
  let enerjiTuketim = enerji && enerji.tuketim ? enerji.tuketim : 0;
  if (enerjiTuketim > 1500) bazFiyat -= 100000;

  // Piyasa koşulu (örnek: rastgele dalgalanma)
  let piyasaDalga = Math.round(Math.random() * 50000);

  let onerilenFiyat = Math.round(bazFiyat * katsayi + piyasaDalga);
  return onerilenFiyat;
}

module.exports = fiyatOnerisi;
