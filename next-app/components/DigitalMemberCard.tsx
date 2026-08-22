'use client';

import React, { useState, useRef, useLayoutEffect } from 'react';
import { toPng } from 'html-to-image';
import { 
  Award, 
  CheckCircle2, 
  Gift, 
  Minus, 
  Plus, 
  Share2, 
  Download,
  Sparkles,
  ShieldCheck,
  RotateCw
} from 'lucide-react';
import { PelangganItem } from '@/components/PelangganView';
import { useDialog } from '@/components/DialogProvider';
import ClickSpark from '@/components/ClickSpark';
import './DigitalMemberCard.css';

interface DigitalMemberCardProps {
  customer: PelangganItem;
  onUpdateStamps?: (type: '75' | '45', newCount: number) => void;
  canEdit?: boolean;
}

const STAMP_COORDS = [
  // Row 1 (y = 1121)
  { slot: 1, cx: 534, cy: 1121, rot: -4 },
  { slot: 2, cx: 1104, cy: 1121, rot: 5 },
  { slot: 3, cx: 1674, cy: 1121, rot: -3 },
  { slot: 4, cx: 2244, cy: 1121, rot: 4 },
  { slot: 5, cx: 2814, cy: 1121, rot: -5 },
  // Row 2 (y = 1649)
  { slot: 6, cx: 534, cy: 1649, rot: 6 },
  { slot: 7, cx: 1104, cy: 1649, rot: -4 },
  { slot: 8, cx: 1674, cy: 1649, rot: 5 },
  { slot: 9, cx: 2244, cy: 1649, rot: -3 },
  { slot: 10, cx: 2814, cy: 1649, rot: 0 },
];

export default function DigitalMemberCard({
  customer,
  onUpdateStamps,
  canEdit = true
}: DigitalMemberCardProps) {
  const { showAlert, showConfirm } = useDialog();
  const [activeCardType, setActiveCardType] = useState<'75' | '45'>('75');
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [downloading, setDownloading] = useState(false);
  const cardFrontRef = useRef<HTMLDivElement>(null);
  const cardBackRef = useRef<HTMLDivElement>(null);

  const tab75Ref = useRef<HTMLButtonElement>(null);
  const tab45Ref = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 4, width: 140 });

  useLayoutEffect(() => {
    const activeEl = activeCardType === '75' ? tab75Ref.current : tab45Ref.current;
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    }
  }, [activeCardType]);

  // Local stamp counts
  const [localStamps75, setLocalStamps75] = useState<number>(customer.stamps75 ?? 0);
  const [localStamps45, setLocalStamps45] = useState<number>(customer.stamps45 ?? 0);

  const currentStamps = activeCardType === '75' ? localStamps75 : localStamps45;
  const isRewardReady = currentStamps >= 10;
  const remainingStamps = Math.max(0, 10 - currentStamps);

  const handleAddStamp = async () => {
    if (currentStamps >= 10) {
      await showAlert('Stempel sudah penuh (10/10)! Silakan klaim reward cuci gratis terlebih dahulu.', 'info');
      return;
    }
    const nextVal = currentStamps + 1;
    if (activeCardType === '75') {
      setLocalStamps75(nextVal);
      onUpdateStamps?.('75', nextVal);
    } else {
      setLocalStamps45(nextVal);
      onUpdateStamps?.('45', nextVal);
    }
  };

  const handleSubtractStamp = () => {
    if (currentStamps <= 0) return;
    const nextVal = currentStamps - 1;
    if (activeCardType === '75') {
      setLocalStamps75(nextVal);
      onUpdateStamps?.('75', nextVal);
    } else {
      setLocalStamps45(nextVal);
      onUpdateStamps?.('45', nextVal);
    }
  };

  const handleClaimReward = async () => {
    const confirmed = await showConfirm(
      `Klaim Reward Cuci Gratis untuk Kartu ${activeCardType === '75' ? '7,5 KG' : '4,5 KG'} atas nama ${customer.nama}?\n\nStempel akan di-reset kembali ke 0.`,
      'Konfirmasi Klaim Reward'
    );
    if (!confirmed) return;

    if (activeCardType === '75') {
      setLocalStamps75(0);
      onUpdateStamps?.('75', 0);
    } else {
      setLocalStamps45(0);
      onUpdateStamps?.('45', 0);
    }
    await showAlert(`Selamat! Reward 1x Cuci Gratis ${activeCardType === '75' ? '7,5 KG' : '4,5 KG'} berhasil diklaim dan kartu di-reset ke 0 stempel.`, 'success');
  };

  const handleDownloadPNG = async () => {
    const targetRef = isFlipped ? cardBackRef.current : cardFrontRef.current;
    if (!targetRef) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(targetRef, {
        cacheBust: true,
        pixelRatio: 2,
        quality: 0.95,
      });
      const sideName = isFlipped ? 'Belakang' : 'Depan';
      const link = document.createElement('a');
      link.download = `Member-Card-${activeCardType === '75' ? '7.5KG' : '4.5KG'}-${customer.nama.replace(/\s+/g, '_')}-${sideName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      await showAlert('Gagal mengunduh kartu member digital.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = () => {
    const phone = customer.noHp.replace(/[^0-9]/g, '');
    const targetPhone = phone.startsWith('0') ? '62' + phone.substring(1) : phone;
    const msg = [
      `Halo Kak *${customer.nama}*!`,
      `Berikut adalah update *Digital Member Loyalty Stamp Card* Anda di *Dua SiSi Laundry*:`,
      ``,
      `*Kartu Member: ${activeCardType === '75' ? '7,5 KG' : '4,5 KG'}*`,
      `Progres Stempel: *${currentStamps} dari 10 Stempel*`,
      isRewardReady 
        ? `*SELAMAT! Anda berhak mendapatkan 1x Cuci GRATIS! Tunjukkan pesan ini saat berkunjung ke outlet.*` 
        : `Kumpulkan *${remainingStamps} stempel lagi* untuk mendapatkan 1x Cuci Gratis!`,
      ``,
      `Terima kasih telah mencuci di Dua SiSi Laundry!`
    ].join('\n');

    const url = `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <ClickSpark sparkColor="#2dd4bf" sparkCount={7} sparkSize={10} sparkRadius={20}>
      <div className="dmc-wrapper space-y-4">
        
        {/* Top Header & Card Switcher */}
        <div className="dmc-header">
          <div className="dmc-header-brand">
            <div className="dmc-header-icon">
              <Award className="w-5 h-5 text-amber-300" />
            </div>
            <div className="dmc-header-text">
              <div className="dmc-title-row">
                <h3 className="dmc-title">Digital Member Loyalty Card</h3>
                <span className="dmc-holo-badge">
                  <ShieldCheck className="w-3 h-3 text-teal-700 inline mr-1" />
                  Anti-Pemalsuan
                </span>
              </div>
              <p className="dmc-subtitle">Kumpulkan 10 stempel untuk klaim 1x cuci gratis</p>
            </div>
          </div>

          {/* Ultra-Smooth Sliding 2-Card Switcher Tabs */}
          <div className="dmc-tabs-container">
            <div 
              className="dmc-tab-indicator" 
              style={{ 
                left: `${indicatorStyle.left}px`, 
                width: `${indicatorStyle.width}px` 
              }} 
            />
            <button
              ref={tab75Ref}
              type="button"
              onClick={() => setActiveCardType('75')}
              className={`dmc-tab-btn ${activeCardType === '75' ? 'active' : ''}`}
            >
              <span>Kartu 7,5 KG</span>
              <span className="dmc-tab-count">
                {localStamps75}/10
              </span>
            </button>

            <button
              ref={tab45Ref}
              type="button"
              onClick={() => setActiveCardType('45')}
              className={`dmc-tab-btn ${activeCardType === '45' ? 'active' : ''}`}
            >
              <span>Kartu 4,5 KG</span>
              <span className="dmc-tab-count">
                {localStamps45}/10
              </span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3D FLIP CARD CONTROLLER & PRESENTATION STAGE */}
        {/* ========================================================================= */}
        <div className="dmc-canvas-stage">
          
          {/* Flip Status & Quick Action Bar */}
          <div className="dmc-flip-controller-bar">
            <div className="dmc-flip-badge-side">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isFlipped ? 'Sisi Belakang: S&K & QR Member' : 'Sisi Depan: 10 Stempel Loyalty'}</span>
            </div>
            
            <button
              type="button"
              onClick={() => setIsFlipped(!isFlipped)}
              className="dmc-btn-flip"
              title="Balik Kartu Member (3D Flip)"
            >
              <RotateCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isFlipped ? 'rotate-180 text-amber-300' : ''}`} />
              <span>{isFlipped ? 'Lihat Sisi Depan' : 'Balik Kartu (Lihat Belakang)'}</span>
            </button>
          </div>

          {/* 3D Perspective Card Box */}
          <div 
            className="dmc-flip-perspective"
            onClick={() => setIsFlipped(!isFlipped)}
            title="Klik untuk membalik kartu (3D Flip)"
          >
            <div className={`dmc-flip-inner ${isFlipped ? 'is-flipped' : ''}`}>
              
              {/* =============================================================== */}
              {/* SISI DEPAN (FRONT FACE - 10 STEMPEL) */}
              {/* =============================================================== */}
              <div 
                ref={cardFrontRef}
                className="dmc-card-face dmc-card-front select-none"
                style={{ aspectRatio: '3322 / 2030' }}
              >
                <svg 
                  viewBox="0 0 3322 2030" 
                  className="w-full h-full block"
                  xmlns="http://www.w3.org/2000/svg"
                  xmlnsXlink="http://www.w3.org/1999/xlink"
                >
                  <defs>
                    <clipPath id="logoClipFront">
                      <rect width="666" height="199" fill="white" transform="translate(1328 113)" />
                    </clipPath>
                  </defs>

                  {/* 1. Luxurious Teal/Emerald Grid Background with Corner Glows */}
                  <image 
                    href="/assets/member-card/card-bg-landscape.webp" 
                    width="3322" 
                    height="2030" 
                    preserveAspectRatio="none" 
                  />

                  {/* 2. Top-Center Dua SiSi Official Logo & Typography (Vectors) */}
                  <g clipPath="url(#logoClipFront)">
                    <path d="M1773.1 274.897C1773.27 274.222 1774.33 274.393 1775.05 273.895C1776.69 272.762 1777.81 270.823 1777.84 268.786V119.02C1777.72 118.057 1776.9 116.145 1776.26 115.464C1775.42 114.566 1774.1 114.593 1773.49 113.695H1989.17C1990.15 113.695 1992.95 116.427 1993.12 117.632V270.954C1992.9 272.546 1989.71 274.89 1988.38 274.89H1773.1V274.897ZM1870.3 149.758C1862.9 150.839 1859.97 160.486 1864.89 166.054C1869.31 171.051 1878.2 169.905 1881.11 163.755C1884.71 156.131 1878.52 148.559 1870.3 149.758ZM1956.97 149.758C1953.51 150.262 1949.71 153.897 1949.22 157.395C1947.44 170.305 1964.54 173.461 1968.21 162.609C1970.74 155.122 1964.65 148.638 1956.98 149.758H1956.97ZM1853.85 164.659C1854.3 164.023 1849.67 159.366 1848.94 158.731C1831.96 143.876 1801.52 153.079 1803.83 177.896C1805.18 192.449 1820.13 196.012 1830.87 200.944C1835.23 202.942 1840.1 205.45 1837.51 211.286C1833.89 219.414 1819.94 215.353 1816.03 209.085H1815.26L1802.25 218.596C1810.37 228.014 1820.12 232.861 1832.77 231.826C1855.95 229.927 1864.08 200.276 1843.33 188.447C1838.02 185.421 1823.56 182.022 1821.08 177.188C1818.77 172.702 1821.9 168.49 1826.51 167.861C1832.66 167.023 1836.57 169.46 1840.98 173.304L1853.85 164.659ZM1940.52 164.659C1927.59 142.586 1887.86 149.444 1890.49 177.896C1891.4 187.701 1899.79 193.412 1907.95 197.132C1913.55 199.693 1928.08 202.516 1924.17 211.286C1920.56 219.414 1906.61 215.353 1902.7 209.085H1901.92L1888.92 218.596C1897.04 228.014 1906.79 232.861 1919.43 231.826C1942.58 229.927 1950.78 200.4 1930 188.447C1924.72 185.408 1910.21 181.996 1907.74 177.188C1905.44 172.702 1908.57 168.49 1913.17 167.861C1919.33 167.023 1923.24 169.46 1927.65 173.304L1940.52 164.659ZM1880.64 175.335H1864.1V229.861H1880.64V175.335ZM1967.3 175.335H1950.76V229.861H1967.3V175.335Z" fill="white"/>
                    <path d="M1476.39 177.43C1516.45 174.391 1524.74 217.881 1513.79 248.128C1489.43 315.439 1401 334.741 1352.57 280.831C1342.82 269.971 1331.79 250.8 1328.61 236.509C1328.44 235.736 1327.36 231.027 1328.54 231.046C1338.97 240.157 1351.65 248.128 1364.98 252.176C1392.76 260.612 1415.18 253.093 1429.65 227.752C1440.54 208.692 1450.34 179.402 1476.38 177.43H1476.39ZM1472.83 192.423C1464.31 193.674 1455.83 205.398 1453.22 213.054C1450.91 219.853 1449.73 233.719 1459.71 234.609C1471.71 235.677 1482.17 219.702 1484.17 209.327C1485.83 200.715 1483.67 190.824 1472.83 192.423Z" fill="white"/>
                    <path d="M1465.3 162.163C1462.69 164.678 1456.24 160.591 1453.04 159.523C1451.35 158.96 1448.66 157.938 1447.03 157.65C1446.02 157.466 1442.39 157.08 1442 157.951L1442.01 159.51C1443.04 161.54 1450.37 172.118 1450.02 173.481C1449.89 173.991 1446.26 177.626 1445.58 178.537C1439.25 186.993 1433.74 200.059 1428.48 209.589C1424.02 217.658 1415.83 234.399 1408.69 239.521C1399 246.464 1390.42 230.823 1385.54 224.064C1380.78 217.468 1376.35 210.604 1371.82 203.852C1371 203.714 1369.69 203.518 1369.38 204.448L1364.98 234.209C1358.84 231.007 1352.4 228.138 1346.5 224.503C1342.35 221.948 1335.67 217.58 1332.1 214.449C1328.19 211.017 1328.54 209.399 1329.25 204.5C1331.97 185.552 1337.07 166.865 1349.03 151.644C1349.81 151.506 1349.51 151.768 1349.7 152.142C1353.09 158.901 1355.7 163.433 1362.5 167.37C1392.22 184.576 1423.19 147.563 1401.61 121.43C1401.03 120.729 1396.81 117.015 1397.28 116.485C1401.04 115.692 1404.76 114.743 1408.58 114.179C1430.44 110.931 1451.33 114.625 1471.22 123.919C1474.85 125.615 1483.72 128.68 1481.61 133.691L1465.3 162.182V162.163Z" fill="white"/>
                    <path d="M1615.13 153.209V229.86H1598.99V225.911C1584.55 237.753 1564.72 231.845 1557.83 214.842C1549.24 193.653 1565.93 166.544 1590.02 174.247C1593.4 175.327 1595.92 177.456 1598.98 178.89V153.209H1615.13H1615.13ZM1584.73 187.674C1565.93 188.591 1567.01 219.296 1587.35 217.206C1604.59 215.438 1602.99 186.783 1584.73 187.674Z" fill="white"/>
                    <path d="M1730.55 229.855V225.905C1707.61 243.838 1681.27 220.05 1688.29 193.988C1693.41 174.988 1714.87 166.093 1730.55 179.284C1730.74 177.87 1730.02 175.983 1731.14 174.935H1746.5L1747.1 175.525V229.848H1730.55V229.855ZM1716.7 187.675C1697.68 188.395 1698.74 219.539 1719.33 217.22C1736.15 215.321 1734.66 186.993 1716.7 187.675Z" fill="white"/>
                    <path d="M1641.13 174.94V205.167C1641.13 215.62 1657.13 220.245 1662.48 209.981C1662.83 209.3 1663.98 206.49 1663.98 205.96V174.947H1679.94L1680.53 175.536V229.86H1663.98V226.303C1661.67 227.266 1659.76 228.851 1657.39 229.761C1645.7 234.261 1632.57 229.381 1627.14 218.011C1626.63 216.957 1624.98 212.752 1624.98 211.874V174.934H1641.13V174.94Z" fill="white"/>
                    <path d="M1831.01 300.97L1829.39 310.808L1826.29 310.847L1830.28 288.775L1833.37 288.722L1832.98 291.093C1838.02 286.332 1845.33 288.087 1844.3 295.934C1843.39 302.824 1835.7 307.52 1831.01 300.97ZM1840.34 292.397C1840.08 292.089 1839.09 291.585 1838.67 291.519C1830.6 290.17 1829.02 302.817 1837.42 300.892C1840.29 300.23 1842.36 294.8 1840.34 292.397H1840.34Z" fill="white"/>
                    <path d="M1766.01 283.594L1762.41 303.689L1759.31 303.735L1759.7 301.364C1753.61 307.193 1746.22 303.073 1748.79 294.559C1750.55 288.729 1757.88 285.756 1761.67 291.487L1762.88 283.608L1766.01 283.588L1766.01 283.594ZM1759.97 292.404C1759.02 291.356 1756.92 291.297 1755.58 291.513C1752.2 292.076 1749.74 298.639 1753.18 300.598C1757.97 303.316 1763.23 295.986 1759.97 292.404Z" fill="white"/>
                    <path d="M1920.43 290.308L1920.23 287.93C1918.55 286.037 1915.49 287.472 1915.9 289.948C1916.19 291.729 1924.97 303.204 1924.36 303.735C1923.38 303.656 1922.11 303.984 1921.21 303.545C1920.37 303.139 1919.53 300.538 1918.64 300.185C1918.03 299.942 1917.27 301.986 1916.67 302.549C1914.09 304.959 1908.71 304.586 1907.91 300.689C1907.07 296.609 1909.9 292.548 1914.12 292.672C1910.85 287.812 1914.95 283.673 1920.19 284.42C1924 284.957 1925.5 291.513 1920.42 290.308H1920.43ZM1913.23 295.115C1909.92 295.803 1909.6 301.18 1913.12 301.318C1918.13 301.514 1917.98 294.133 1913.23 295.115Z" fill="white"/>
                    <path d="M1952.34 291.093C1948.16 291.964 1949.61 289.822 1947.75 288.381C1944.37 285.761 1939.29 287.916 1937.69 291.61C1935.26 297.23 1938.34 303.157 1944.86 300.374C1947.22 299.365 1947.84 296.077 1951.16 297.02C1950.2 302.299 1943.27 305.129 1938.47 303.623C1931.63 301.481 1932.77 291.525 1937.02 287.379C1941.81 282.709 1952.3 282.866 1952.34 291.086V291.093Z" fill="white"/>
                    <path d="M1707.71 291.094L1708.5 290.891L1708.86 288.899L1712.04 288.729L1709.27 303.721L1706.13 303.741L1706.52 300.977C1700.19 307.979 1692.32 302.49 1695.81 293.589C1697.64 288.919 1704.79 285.985 1707.71 291.1V291.094ZM1702.07 291.578C1698.79 292.338 1696.43 299.182 1699.93 300.676C1707.72 304.003 1711.21 289.463 1702.07 291.578Z" fill="white"/>
                    <path d="M1813.28 284.381L1812.84 287.106L1805.05 287.191L1804.22 292.679H1810.91L1810.46 295.391L1803.43 295.45L1802.64 300.971H1809.93L1810.42 301.548L1810.12 303.742H1799.09L1802.84 284.381H1813.28Z" fill="white"/>
                    <path d="M1860.15 297.021C1859.85 299.732 1861.03 301.54 1863.88 301.383C1867.12 301.199 1867.49 297.551 1871.18 298.606C1869.63 304.933 1858.63 306.537 1857.18 299.418C1855.83 292.809 1862.35 286.397 1868.82 288.925C1872.19 290.248 1872.83 294.073 1871.38 297.021H1860.15ZM1860.55 295.442H1868.82C1870.17 289.109 1861.11 290.15 1860.55 295.442Z" fill="white"/>
                    <path d="M1962.5 288.435C1972.24 287.584 1971.77 301.089 1963.45 303.63C1951.38 307.324 1951.18 289.424 1962.5 288.435ZM1961.28 291.579C1957.24 292.502 1955.9 300.238 1959.63 300.965C1967.39 302.471 1969.54 289.686 1961.28 291.579Z" fill="white"/>
                    <path d="M1781.35 288.743L1783.74 299.386L1789.73 288.802C1790.29 288.775 1793.61 288.251 1793.19 289.306L1780.5 310.763L1777.04 310.841L1781.33 303.159L1777.83 288.723L1781.35 288.736V288.743Z" fill="white"/>
                    <path d="M1992.51 303.735H1989.37C1988.99 300.335 1993.63 291.153 1987.6 291.081C1981.87 291.009 1982.21 299.772 1981.49 303.735H1978.33L1980.72 288.742L1983.85 288.723L1983.46 291.094C1985.72 289.273 1987.78 287.694 1990.87 288.598C1996.92 290.36 1992.3 299.412 1992.51 303.735Z" fill="white"/>
                    <path d="M1718.34 288.73C1717.94 292.149 1714.15 301.135 1719.72 301.397C1725.54 301.666 1724.93 292.85 1726 289.103L1729.36 288.73L1726.56 303.696L1723.46 303.735L1723.84 300.971C1723.07 301.535 1722.97 302.222 1722.01 302.877C1719.91 304.305 1716.42 304.751 1714.53 302.805C1711.7 299.904 1714.85 293.02 1714.85 289.372L1715.44 288.769L1718.33 288.717L1718.34 288.73Z" fill="white"/>
                    <path d="M1744.3 303.702L1741.19 303.741C1741.28 300.381 1745.47 291.094 1739.41 291.094C1733.87 291.094 1734.4 299.982 1733.27 303.702L1730.15 303.741L1732.88 288.9L1736.06 288.736L1735.67 291.101C1738 288.978 1740.7 287.4 1743.82 289.044C1748.15 291.33 1744.62 299.812 1744.29 303.702H1744.3Z" fill="white"/>
                    <path d="M1899.42 290.046C1899.88 290.531 1901.11 293.105 1900.73 293.465L1897.82 293.491C1897.46 289.542 1889.87 290.426 1892.04 293.694C1893.4 295.751 1900.11 294.827 1899.92 299.563C1899.68 305.805 1887.44 305.641 1887.74 299.006L1890.65 298.98C1891.5 304.03 1899.55 300.912 1896.17 298.253C1893.76 296.347 1888.74 297.565 1888.89 292.876C1889.04 288.055 1896.58 287.086 1899.43 290.046H1899.42Z" fill="white"/>
                    <path d="M1885.23 290.046C1885.7 290.531 1886.92 293.105 1886.54 293.465L1883.64 293.491C1883.28 289.542 1875.69 290.426 1877.86 293.694C1879.22 295.751 1885.92 294.827 1885.74 299.563C1885.49 305.805 1873.26 305.641 1873.56 299.006L1876.47 298.98C1877.32 304.03 1885.36 300.912 1881.99 298.253C1879.57 296.347 1874.56 297.565 1874.71 292.876C1874.86 288.055 1882.39 287.086 1885.25 290.046H1885.23Z" fill="white"/>
                    <path d="M1817.94 288.788L1820.18 293.471C1823.13 291.525 1823.26 287.589 1827.85 288.729L1821.64 296.425L1825.48 303.734C1821.29 304.605 1820.94 302.044 1819.37 298.992C1816.29 300.813 1816.31 304.906 1811.7 303.734L1817.62 296.019L1814.06 288.729L1817.94 288.788H1817.94Z" fill="white"/>
                    <path d="M1682.1 303.741L1685.62 284.557L1688.41 284.583L1685.65 301.37H1691.94V303.741H1682.1Z" fill="white"/>
                    <path d="M1857 288.33L1856.6 291.88C1849.33 291.212 1849.9 298.561 1849.12 303.742H1845.97L1848.35 288.75L1851.49 288.73L1851.28 291.094C1851.75 290.079 1856.55 287.859 1857 288.33H1857Z" fill="white"/>
                    <path d="M1777.43 288.33L1777.03 291.88C1769.75 291.212 1770.33 298.561 1769.55 303.742H1766.4L1768.78 288.75L1771.91 288.73L1771.71 291.094C1772.18 290.079 1776.97 287.859 1777.42 288.33H1777.43Z" fill="white"/>
                    <path d="M1977.15 288.729L1974.35 303.695L1971.25 303.734L1973.78 289.096C1974.25 288.395 1976.3 288.827 1977.15 288.729Z" fill="white"/>
                    <path d="M1974.45 285.9L1974.46 283.26C1975.8 282.612 1976.91 281.93 1978.15 283.195C1978.88 285.585 1976.52 287.098 1974.45 285.906V285.9Z" fill="white"/>
                  </g>

                  {/* 3. "MEMBER CARD" Big Crisp Title */}
                  <path d="M974.182 355.469H1014.45L1048.61 438.762H1050.18L1084.34 355.469H1124.61V490H1092.95V407.363H1091.83L1059.51 489.146H1039.28L1006.96 406.903H1005.84V490H974.182V355.469ZM1144.89 490V355.469H1238.7V381.876H1177.41V409.465H1233.9V435.938H1177.41V463.593H1238.7V490H1144.89ZM1259.06 355.469H1299.33L1333.49 438.762H1335.06L1369.22 355.469H1409.49V490H1377.83V407.363H1376.71L1344.39 489.146H1324.16L1291.84 406.903H1290.72V490H1259.06V355.469ZM1429.77 490V355.469H1485.87C1495.94 355.469 1504.37 356.892 1511.16 359.738C1517.99 362.585 1523.11 366.57 1526.53 371.694C1529.99 376.818 1531.72 382.752 1531.72 389.496C1531.72 394.619 1530.65 399.196 1528.5 403.225C1526.35 407.21 1523.4 410.516 1519.63 413.144C1515.87 415.771 1511.51 417.611 1506.56 418.662V419.975C1511.99 420.238 1517 421.705 1521.6 424.377C1526.24 427.048 1529.97 430.77 1532.77 435.544C1535.57 440.273 1536.97 445.879 1536.97 452.36C1536.97 459.586 1535.13 466.045 1531.46 471.738C1527.78 477.388 1522.46 481.855 1515.49 485.139C1508.53 488.38 1500.08 490 1490.14 490H1429.77ZM1462.29 463.79H1482.39C1489.44 463.79 1494.63 462.454 1497.95 459.783C1501.33 457.112 1503.01 453.389 1503.01 448.616C1503.01 445.156 1502.2 442.178 1500.58 439.682C1498.96 437.142 1496.66 435.193 1493.68 433.836C1490.71 432.434 1487.14 431.734 1482.98 431.734H1462.29V463.79ZM1462.29 410.779H1480.28C1483.83 410.779 1486.98 410.188 1489.74 409.005C1492.5 407.823 1494.65 406.115 1496.18 403.882C1497.76 401.648 1498.55 398.955 1498.55 395.802C1498.55 391.291 1496.95 387.744 1493.75 385.16C1490.55 382.576 1486.24 381.284 1480.81 381.284H1462.29V410.779ZM1552.61 490V355.469H1646.41V381.876H1585.12V409.465H1641.62V435.938H1585.12V463.593H1646.41V490H1552.61ZM1666.78 490V355.469H1722.35C1732.42 355.469 1741.11 357.286 1748.43 360.921C1755.78 364.512 1761.46 369.679 1765.44 376.423C1769.43 383.124 1771.42 391.072 1771.42 400.269C1771.42 409.596 1769.38 417.523 1765.31 424.048C1761.24 430.529 1755.46 435.478 1747.97 438.894C1740.48 442.266 1731.61 443.952 1721.36 443.952H1686.22V418.333H1715.32C1720.22 418.333 1724.32 417.698 1727.6 416.428C1730.93 415.114 1733.45 413.144 1735.16 410.516C1736.87 407.845 1737.72 404.429 1737.72 400.269C1737.72 396.108 1736.87 392.671 1735.16 389.955C1733.45 387.196 1730.93 385.138 1727.6 383.781C1724.28 382.379 1720.18 381.679 1715.32 381.679H1699.29V490H1666.78ZM1742.51 428.515L1776.02 490H1740.54L1707.7 428.515H1742.51ZM1951.11 404.21H1918.27C1917.83 400.838 1916.93 397.794 1915.57 395.079C1914.22 392.364 1912.42 390.043 1910.19 388.116C1907.95 386.189 1905.3 384.722 1902.24 383.715C1899.22 382.664 1895.87 382.138 1892.19 382.138C1885.66 382.138 1880.04 383.737 1875.31 386.934C1870.62 390.131 1867.01 394.751 1864.47 400.794C1861.97 406.838 1860.72 414.151 1860.72 422.734C1860.72 431.668 1861.99 439.157 1864.53 445.2C1867.12 451.2 1870.73 455.732 1875.37 458.798C1880.06 461.819 1885.6 463.33 1891.99 463.33C1895.58 463.33 1898.84 462.87 1901.78 461.951C1904.76 461.031 1907.36 459.695 1909.6 457.944C1911.87 456.148 1913.73 453.98 1915.18 451.44C1916.67 448.857 1917.7 445.944 1918.27 442.704L1951.11 442.901C1950.54 448.857 1948.81 454.725 1945.92 460.506C1943.07 466.286 1939.16 471.563 1934.16 476.337C1929.17 481.066 1923.08 484.832 1915.9 487.635C1908.76 490.438 1900.57 491.839 1891.33 491.839C1879.16 491.839 1868.25 489.168 1858.62 483.825C1849.03 478.439 1841.45 470.6 1835.89 460.309C1830.33 450.017 1827.55 437.492 1827.55 422.734C1827.55 407.932 1830.37 395.386 1836.02 385.094C1841.67 374.803 1849.31 366.986 1858.95 361.643C1868.58 356.301 1879.38 353.629 1891.33 353.629C1899.48 353.629 1907.01 354.768 1913.93 357.045C1920.85 359.279 1926.94 362.563 1932.19 366.899C1937.45 371.19 1941.72 376.467 1945 382.73C1948.29 388.992 1950.32 396.152 1951.11 404.21ZM1995.39 490H1960.44L2005.83 355.469H2049.12L2094.51 490H2059.56L2027.97 389.364H2026.92L1995.39 490ZM1990.72 437.055H2063.77V461.754H1990.72V437.055ZM2108.99 490V355.469H2164.57C2174.64 355.469 2183.33 357.286 2190.65 360.921C2198 364.512 2203.67 369.679 2207.66 376.423C2211.65 383.124 2213.64 391.072 2213.64 400.269C2213.64 409.596 2211.6 417.523 2207.53 424.048C2203.46 430.529 2197.68 435.478 2190.19 438.894C2182.7 442.266 2173.83 443.952 2163.58 443.952H2128.44V418.333H2157.54C2162.44 418.333 2166.54 417.698 2169.82 416.428C2173.15 415.114 2175.67 413.144 2177.38 410.516C2179.09 407.845 2179.94 404.429 2179.94 400.269C2179.94 396.108 2179.09 392.671 2177.38 389.955C2175.67 387.196 2173.15 385.138 2169.82 383.781C2166.49 382.379 2162.4 381.679 2157.54 381.679H2141.51V490H2108.99ZM2184.73 428.515L2218.24 490H2182.76L2149.92 428.515H2184.73ZM2281.2 490H2231.47V355.469H2281.13C2294.84 355.469 2306.64 358.162 2316.54 363.548C2326.48 368.891 2334.14 376.599 2339.53 386.671C2344.92 396.7 2347.61 408.699 2347.61 422.669C2347.61 436.682 2344.92 448.725 2339.53 458.798C2334.19 468.87 2326.55 476.599 2316.61 481.986C2306.66 487.329 2294.86 490 2281.2 490ZM2263.99 462.279H2279.95C2287.48 462.279 2293.86 461.009 2299.07 458.469C2304.32 455.885 2308.28 451.703 2310.96 445.923C2313.67 440.098 2315.03 432.347 2315.03 422.669C2315.03 412.99 2313.67 405.283 2310.96 399.546C2308.24 393.765 2304.23 389.605 2298.93 387.065C2293.68 384.481 2287.2 383.189 2279.49 383.189H2263.99V462.279Z" fill="white"/>

                  {/* 4. Top-Right Weight Badge (7,5 or 4,5) */}
                  <circle cx="2942" cy="261" r="156" fill="white" />
                  {activeCardType === '75' ? (
                    <g>
                      <path d="M2862.24 295.289L2899.06 222.365V221.785H2856V204H2921.88V221.919L2884.93 295.289H2862.24Z" fill="black"/>
                      <path d="M2940.73 282.808L2940.32 287.756C2939.97 291.857 2939.24 295.854 2938.14 299.747C2937.07 303.669 2935.93 307.191 2934.71 310.311C2933.49 313.431 2932.52 315.853 2931.81 317.577H2918.08C2918.56 315.853 2919.2 313.431 2920 310.311C2920.83 307.191 2921.6 303.669 2922.32 299.747C2923.03 295.824 2923.43 291.842 2923.52 287.801L2923.61 282.808H2940.73Z" fill="black"/>
                      <path d="M2991.86 296.537C2985.21 296.537 2979.29 295.334 2974.12 292.927C2968.95 290.52 2964.87 287.206 2961.87 282.987C2958.89 278.767 2957.35 273.923 2957.23 268.455H2978.63C2978.8 271.813 2980.17 274.517 2982.73 276.568C2985.28 278.588 2988.33 279.599 2991.86 279.599C2994.63 279.599 2997.08 278.99 2999.22 277.771C3001.36 276.553 3003.04 274.844 3004.26 272.645C3005.47 270.416 3006.07 267.861 3006.04 264.978C3006.07 262.036 3005.46 259.466 3004.21 257.267C3002.99 255.068 3001.3 253.359 2999.13 252.141C2996.99 250.893 2994.52 250.269 2991.73 250.269C2989.09 250.239 2986.57 250.818 2984.2 252.007C2981.85 253.196 2980.07 254.815 2978.85 256.866L2959.37 253.211L2963.34 204H3021.91V221.785H2981.48L2979.38 243.315H2979.92C2981.43 240.789 2983.87 238.709 2987.23 237.074C2990.62 235.41 2994.46 234.578 2998.77 234.578C3004.24 234.578 3009.11 235.856 3013.39 238.412C3017.7 240.938 3021.09 244.444 3023.56 248.931C3026.05 253.419 3027.3 258.56 3027.3 264.354C3027.3 270.624 3025.82 276.181 3022.84 281.025C3019.9 285.869 3015.77 289.673 3010.45 292.436C3005.16 295.17 2998.97 296.537 2991.86 296.537Z" fill="black"/>
                    </g>
                  ) : (
                    <text 
                      x="2942" 
                      y="300" 
                      textAnchor="middle" 
                      fill="#000000" 
                      fontSize="135" 
                      fontWeight="900" 
                      fontFamily="sans-serif"
                    >
                      4,5
                    </text>
                  )}

                  {/* 5. Customer Name Pill (White rounded rectangle with centered bold text) */}
                  <rect x="224" y="554" width="1450" height="248" rx="48" fill="white" />
                  <text 
                    x={224 + 1450 / 2} 
                    y="708" 
                    textAnchor="middle" 
                    fill="#000000" 
                    fontSize={customer.nama && customer.nama.length > 18 ? "68" : "84"} 
                    fontWeight="900" 
                    fontFamily="sans-serif"
                    letterSpacing="2"
                  >
                    {`(${customer.nama ? customer.nama.toUpperCase() : 'NAMA'})`}
                  </text>

                  {/* 6. Customer Phone Pill (White rounded rectangle with centered bold text) */}
                  <rect x="1758" y="554" width="1340" height="248" rx="48" fill="white" />
                  <text 
                    x={1758 + 1340 / 2} 
                    y="708" 
                    textAnchor="middle" 
                    fill="#000000" 
                    fontSize="84" 
                    fontWeight="900" 
                    fontFamily="sans-serif"
                    letterSpacing="2"
                  >
                    {`(${customer.maskedHp || customer.noHp || 'NO HP'})`}
                  </text>

                  {/* 7. 10 STAMP CIRCLE SLOTS */}
                  {STAMP_COORDS.map(({ slot, cx, cy, rot }) => {
                    const isStamped = currentStamps >= slot;
                    const isReward = slot === 10;

                    return (
                      <g key={slot}>
                        {/* Clean white circle base (100% exact to design) */}
                        <circle cx={cx} cy={cy} r="230" fill="white" />

                        {/* Dynamic Digital Stamp Overlay when Stamped */}
                        {isStamped && (
                          isReward ? (
                            /* Slot 10 Celebratory Reward Seal */
                            <g transform={`rotate(${rot}, ${cx}, ${cy})`}>
                              <circle cx={cx} cy={cy} r="215" fill="#FEF3C7" stroke="#D97706" strokeWidth="12" strokeDasharray="16 8" />
                              <circle cx={cx} cy={cy} r="185" fill="#F59E0B" stroke="#B45309" strokeWidth="8" />
                              <circle cx={cx} cy={cy} r="150" fill="#78350F" />
                              
                              {/* Stars & Text */}
                              <text x={cx} y={cy - 80} textAnchor="middle" fill="#FDE68A" fontSize="40" fontWeight="900">
                                ★ ★ ★ ★ ★
                              </text>
                              <text x={cx} y={cy - 18} textAnchor="middle" fill="#FFFFFF" fontSize="60" fontWeight="900" fontFamily="sans-serif">
                                GRATIS
                              </text>
                              <text x={cx} y={cy + 42} textAnchor="middle" fill="#FDE68A" fontSize="52" fontWeight="900" fontFamily="sans-serif">
                                1x CUCI
                              </text>
                              <text x={cx} y={cy + 100} textAnchor="middle" fill="#FEF3C7" fontSize="34" fontWeight="800">
                                DUA SISI LAUNDRY
                              </text>
                            </g>
                          ) : (
                            /* Regular Stamped Seal (Slots 1-9) */
                            <g transform={`rotate(${rot}, ${cx}, ${cy})`}>
                              {/* Outer Seal Rings */}
                              <circle cx={cx} cy={cy} r="215" fill="#E6FFFA" stroke="#0D9488" strokeWidth="12" strokeDasharray="14 6" />
                              <circle cx={cx} cy={cy} r="185" fill="#1E4648" stroke="#115E59" strokeWidth="6" />
                              <circle cx={cx} cy={cy} r="155" fill="#0D3133" stroke="#2DD4BF" strokeWidth="4" />

                              {/* Stamp Header Text */}
                              <text x={cx} y={cy - 75} textAnchor="middle" fill="#99F6E4" fontSize="32" fontWeight="800" letterSpacing="3">
                                DUA SISI LAUNDRY
                              </text>

                              {/* Stamp Checkmark */}
                              <path 
                                d={`M ${cx - 45} ${cy - 10} L ${cx - 15} ${cy + 25} L ${cx + 50} ${cy - 40}`} 
                                fill="none" 
                                stroke="#FBBF24" 
                                strokeWidth="16" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                              />

                              {/* Stamp Verified Text */}
                              <text x={cx} y={cy + 70} textAnchor="middle" fill="#FDE68A" fontSize="40" fontWeight="900" letterSpacing="4">
                                VALID
                              </text>
                              <text x={cx} y={cy + 112} textAnchor="middle" fill="#5EEAD4" fontSize="28" fontWeight="700">
                                STAMP #{slot}
                              </text>
                            </g>
                          )
                        )}
                      </g>
                    );
                  })}

                </svg>
              </div>

              {/* =============================================================== */}
              {/* SISI BELAKANG (BACK FACE - SYARAT & KETENTUAN + QR MEMBER) */}
              {/* =============================================================== */}
              <div 
                ref={cardBackRef}
                className="dmc-card-face dmc-card-back select-none"
                style={{ aspectRatio: '3322 / 2030' }}
              >
                <svg 
                  viewBox="0 0 3322 2030" 
                  className="w-full h-full block"
                  xmlns="http://www.w3.org/2000/svg"
                  xmlnsXlink="http://www.w3.org/1999/xlink"
                >
                  <defs>
                    <linearGradient id="dmc-back-gold-ribbon" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#D97706" />
                      <stop offset="50%" stopColor="#FDE68A" />
                      <stop offset="100%" stopColor="#B45309" />
                    </linearGradient>
                    <filter id="dmc-back-drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000000" floodOpacity="0.6" />
                    </filter>
                  </defs>

                  {/* High-Resolution Landscape Card Background */}
                  <image 
                    href="/assets/member-card/card-bg-landscape.webp" 
                    x="0" 
                    y="0" 
                    width="3322" 
                    height="2030" 
                    preserveAspectRatio="none" 
                  />

                  {/* Dark Glass Overlay for High Contrast */}
                  <rect x="0" y="0" width="3322" height="2030" fill="#011615" fillOpacity="0.88" />

                  {/* Top VIP Magnetic Stripe */}
                  <rect x="0" y="90" width="3322" height="220" fill="#020B0A" />
                  <line x1="0" y1="310" x2="3322" y2="310" stroke="url(#dmc-back-gold-ribbon)" strokeWidth="10" />

                  {/* Magnetic Stripe Holographic Text */}
                  <text x="180" y="235" fill="#5EEAD4" fontSize="58" fontWeight="900" letterSpacing="12">
                    DUA SISI LAUNDRY • OFFICIAL LOYALTY CARD
                  </text>
                  <text x="3140" y="235" textAnchor="end" fill="#FDE68A" fontSize="48" fontWeight="800" letterSpacing="4">
                    VIP PASS
                  </text>

                  {/* LEFT COLUMN: Syarat & Ketentuan (Terms & Conditions) */}
                  <g transform="translate(180, 440)">
                    
                    {/* Section Header */}
                    <text x="0" y="60" fill="#FDE68A" fontSize="72" fontWeight="900" letterSpacing="2">
                      SYARAT &amp; KETENTUAN MEMBER
                    </text>
                    <text x="0" y="115" fill="#5EEAD4" fontSize="38" fontWeight="700" letterSpacing="2">
                      PROGRAM LOYALITAS KARTU {activeCardType === '75' ? '7,5 KG' : '4,5 KG'}
                    </text>
                    <line x1="0" y1="150" x2="1850" y2="150" stroke="#0D9488" strokeWidth="4" strokeDasharray="12 6" />

                    {/* Rule 1 */}
                    <g transform="translate(0, 240)">
                      <circle cx="40" cy="-10" r="28" fill="#0F766E" />
                      <text x="40" y="3" textAnchor="middle" fill="#FFFFFF" fontSize="36" fontWeight="900">1</text>
                      <text x="100" y="0" fill="#FFFFFF" fontSize="48" fontWeight="700">
                        Setiap transaksi 1 load cuci <tspan fill="#5EEAD4" fontWeight="900">({activeCardType === '75' ? '7,5 KG' : '4,5 KG'})</tspan> berhak mendapatkan 1 stempel.
                      </text>
                    </g>

                    {/* Rule 2 */}
                    <g transform="translate(0, 400)">
                      <circle cx="40" cy="-10" r="28" fill="#0F766E" />
                      <text x="40" y="3" textAnchor="middle" fill="#FFFFFF" fontSize="36" fontWeight="900">2</text>
                      <text x="100" y="0" fill="#FFFFFF" fontSize="48" fontWeight="700">
                        Kumpulkan <tspan fill="#FDE68A" fontWeight="900">10 Stempel Penuh</tspan> untuk klaim <tspan fill="#FDE68A" fontWeight="900">1x Cuci GRATIS</tspan>.
                      </text>
                    </g>

                    {/* Rule 3 */}
                    <g transform="translate(0, 560)">
                      <circle cx="40" cy="-10" r="28" fill="#0F766E" />
                      <text x="40" y="3" textAnchor="middle" fill="#FFFFFF" fontSize="36" fontWeight="900">3</text>
                      <text x="100" y="0" fill="#FFFFFF" fontSize="48" fontWeight="700">
                        Kartu terdaftar atas nama <tspan fill="#5EEAD4" fontWeight="900">{customer.nama}</tspan> ({customer.maskedHp || customer.noHp}).
                      </text>
                    </g>

                    {/* Rule 4 */}
                    <g transform="translate(0, 720)">
                      <circle cx="40" cy="-10" r="28" fill="#0F766E" />
                      <text x="40" y="3" textAnchor="middle" fill="#FFFFFF" fontSize="36" fontWeight="900">4</text>
                      <text x="100" y="0" fill="#FFFFFF" fontSize="48" fontWeight="700">
                        Berlaku di seluruh cabang &amp; outlet resmi <tspan fill="#FFFFFF" fontWeight="900">Dua SiSi Laundry Express &amp; Coin</tspan>.
                      </text>
                    </g>

                    {/* Rule 5 */}
                    <g transform="translate(0, 880)">
                      <circle cx="40" cy="-10" r="28" fill="#0F766E" />
                      <text x="40" y="3" textAnchor="middle" fill="#FFFFFF" fontSize="36" fontWeight="900">5</text>
                      <text x="100" y="0" fill="#FFFFFF" fontSize="48" fontWeight="700">
                        Tunjukkan kartu digital atau sebutkan nomor WA saat transaksi di kasir.
                      </text>
                    </g>

                    {/* Reward Progress Note */}
                    <g transform="translate(0, 1060)">
                      <rect x="0" y="0" width="1850" height="150" rx="30" fill="#042F2E" stroke="#2DD4BF" strokeWidth="4" />
                      <text x="60" y="92" fill="#5EEAD4" fontSize="50" fontWeight="900">
                        STATUS SAAT INI: <tspan fill="#FDE68A">{currentStamps} / 10 STEMPEL</tspan> {isRewardReady ? '(SIAP DIKLAIM)' : `(Kurang ${remainingStamps} lagi)`}
                      </text>
                    </g>

                  </g>

                  {/* RIGHT COLUMN: Digital Member QR Verification Box */}
                  <g transform="translate(2220, 440)">
                    
                    {/* Box Frame */}
                    <rect 
                      x="0" 
                      y="0" 
                      width="920" 
                      height="1240" 
                      rx="48" 
                      fill="#031E1D" 
                      stroke="#2DD4BF" 
                      strokeWidth="6" 
                      filter="url(#dmc-back-drop-shadow)" 
                    />

                    {/* QR Code Container (White Canvas) */}
                    <rect x="130" y="90" width="660" height="660" rx="36" fill="#FFFFFF" />

                    {/* Stylized QR Code Graphic in Vector */}
                    <g transform="translate(190, 150) scale(1.68)">
                      {/* Top-Left Finder */}
                      <rect x="0" y="0" width="100" height="100" fill="#042F2E" rx="12" />
                      <rect x="15" y="15" width="70" height="70" fill="#FFFFFF" rx="8" />
                      <rect x="30" y="30" width="40" height="40" fill="#0D9488" rx="4" />

                      {/* Top-Right Finder */}
                      <rect x="220" y="0" width="100" height="100" fill="#042F2E" rx="12" />
                      <rect x="235" y="15" width="70" height="70" fill="#FFFFFF" rx="8" />
                      <rect x="250" y="30" width="40" height="40" fill="#0D9488" rx="4" />

                      {/* Bottom-Left Finder */}
                      <rect x="0" y="220" width="100" height="100" fill="#042F2E" rx="12" />
                      <rect x="15" y="235" width="70" height="70" fill="#FFFFFF" rx="8" />
                      <rect x="30" y="250" width="40" height="40" fill="#0D9488" rx="4" />

                      {/* QR Pattern Blocks */}
                      <rect x="120" y="20" width="30" height="60" fill="#042F2E" />
                      <rect x="170" y="10" width="30" height="30" fill="#042F2E" />
                      <rect x="120" y="100" width="80" height="30" fill="#0D9488" />
                      <rect x="20" y="120" width="60" height="30" fill="#042F2E" />
                      <rect x="240" y="120" width="60" height="40" fill="#042F2E" />
                      <rect x="130" y="150" width="60" height="60" fill="#F59E0B" rx="10" />
                      <rect x="120" y="230" width="40" height="70" fill="#042F2E" />
                      <rect x="180" y="250" width="70" height="40" fill="#0D9488" />
                      <rect x="270" y="220" width="40" height="80" fill="#042F2E" />
                      <rect x="180" y="190" width="40" height="40" fill="#042F2E" />
                    </g>

                    {/* Member ID Details */}
                    <text x="460" y="850" textAnchor="middle" fill="#5EEAD4" fontSize="42" fontWeight="900" letterSpacing="3">
                      ID: DUA-SISI-{activeCardType === '75' ? '75' : '45'}-{customer.noHp.replace(/[^0-9]/g, '').slice(-4) || '0000'}
                    </text>

                    {/* Member Name */}
                    <text x="460" y="930" textAnchor="middle" fill="#FFFFFF" fontSize="56" fontWeight="900" letterSpacing="1">
                      {customer.nama.toUpperCase().slice(0, 16)}
                    </text>

                    {/* Verified Security Subtitle */}
                    <rect x="110" y="990" width="700" height="130" rx="28" fill="#042F2E" stroke="#14B8A6" strokeWidth="3" />
                    <text x="460" y="1070" textAnchor="middle" fill="#FDE68A" fontSize="38" fontWeight="800" letterSpacing="2">
                      VERIFIED DIGITAL MEMBER
                    </text>

                  </g>

                  {/* BOTTOM INFO BAR */}
                  <g transform="translate(180, 1850)">
                    <text x="0" y="0" fill="#94A3B8" fontSize="42" fontWeight="700">
                      Customer Service: <tspan fill="#5EEAD4" fontWeight="900">0856-XXXX-XXXX</tspan> • Instagram: <tspan fill="#5EEAD4" fontWeight="900">@duasisi_laundry</tspan>
                    </text>
                    <text x="2960" y="0" textAnchor="end" fill="#94A3B8" fontSize="42" fontWeight="700">
                      Dua SiSi Laundry POS System
                    </text>
                  </g>

                </svg>
              </div>

            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* REWARD BANNER (IF 10/10 REACHED) */}
        {/* ========================================================================= */}
        {isRewardReady && (
          <div className="dmc-reward-banner">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-300 flex items-center justify-center shrink-0 shadow-md">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-black tracking-tight">TARGET 10 STEMPEL TERCAPAI</div>
                <div className="text-xs font-semibold text-slate-800">
                  Pelanggan berhak mendapatkan <strong>1x Cuci Gratis ({activeCardType === '75' ? '7,5 KG' : '4,5 KG'})</strong>.
                </div>
              </div>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={handleClaimReward}
                className="dmc-reward-claim-btn"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                <span>Klaim Reward &amp; Reset</span>
              </button>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ACTION TOOLBAR & STAMP CONTROLS */}
        {/* ========================================================================= */}
        <div className="dmc-toolbar">
          
          {/* Stamp Counter & Add/Subtract Buttons */}
          <div className="dmc-stepper-group">
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={handleSubtractStamp}
                  disabled={currentStamps <= 0}
                  className="dmc-btn-stepper-minus"
                  title="Kurangi Stempel (-1)"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="dmc-counter-pill">
                  <span className="dmc-counter-label">Stempel</span>
                  <span className="dmc-counter-val">
                    {currentStamps} / 10
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAddStamp}
                  disabled={currentStamps >= 10}
                  className="dmc-btn-stamp-add"
                  title="Tambah Stempel (+1)"
                >
                  <Plus className="w-4 h-4" />
                  <span>Beri Stempel (+1)</span>
                </button>
              </>
            )}
          </div>

          {/* Flip, Share & Download Buttons */}
          <div className="dmc-actions-group">
            <button
              type="button"
              onClick={() => setIsFlipped(!isFlipped)}
              className="dmc-btn-download"
              title="Balik Kartu Member (3D Flip)"
            >
              <RotateCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isFlipped ? 'rotate-180 text-teal-600' : 'text-slate-500'}`} />
              <span>{isFlipped ? 'Sisi Depan' : 'Balik Kartu'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="dmc-btn-wa"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Kirim WA</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPNG}
              disabled={downloading}
              className="dmc-btn-download"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Mengunduh...' : `Unduh ${isFlipped ? 'Belakang' : 'Depan'}`}</span>
            </button>
          </div>

        </div>

      </div>
    </ClickSpark>
  );
}
