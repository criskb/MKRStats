import { lastNDays } from '../../utils/date.js';

const MODELS = [
  'Articulated Dragon v3',
  'Desk Cable Organizer Pro',
  'Wall Planter Set',
  'Modular Dice Tower',
  'Phone Stand Mini'
];

function seededRandom(seed) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

export function buildMockPlatformSnapshot(platformId) {
  const days = lastNDays(30);
  const series = days.map((date, index) => {
    const seed = index + platformId.length;
    const views = Math.floor(500 + seededRandom(seed) * 1800);
    const downloads = Math.floor(views * (0.1 + seededRandom(seed + 22) * 0.08));
    const sales = Math.floor(downloads * (0.08 + seededRandom(seed + 50) * 0.2));
    const revenue = Number((sales * (3 + seededRandom(seed + 81) * 5)).toFixed(2));

    return { date, views, downloads, sales, revenue };
  });

  const models = MODELS.map((name, index) => {
    const seed = platformId.length * (index + 1);
    const downloads = Math.floor(250 + seededRandom(seed + 100) * 3000);
    const sales = Math.floor(downloads * (0.05 + seededRandom(seed + 200) * 0.25));
    const revenue = Number((sales * (2.5 + seededRandom(seed + 300) * 6)).toFixed(2));

    return {
      id: `${platformId}-${index + 1}`,
      title: name,
      downloads,
      sales,
      revenue,
      conversionRate: Number(((sales / Math.max(downloads, 1)) * 100).toFixed(2))
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return {
    platformId,
    connected: true,
    fetchedAt: new Date().toISOString(),
    series,
    models
  };
}
