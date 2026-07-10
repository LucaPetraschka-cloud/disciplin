// Thin Chart.js wrapper applying the dark chart theme + mark specs consistently
// (2px lines, rounded data-ends, recessive gridlines, crosshair tooltip).

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const GRID = () => cssVar('--gridline');
const MUTED = () => cssVar('--text-muted');
const SECONDARY = () => cssVar('--text-secondary');
const SURFACE = () => cssVar('--surface-2');

export const SERIES_COLORS = ['--series-1','--series-2','--series-3','--series-4','--series-5','--series-6','--series-7','--series-8'].map(cssVar);

// Canvas fillStyle/strokeStyle can't reliably resolve var(--x) on iOS Safari,
// so chart data always needs the actual resolved hex — CSS elements can keep var().
export function resolveColor(value) {
  const m = /var\((--[a-zA-Z0-9-]+)\)/.exec(value || '');
  return m ? cssVar(m[1]) : value;
}

Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', sans-serif";
Chart.defaults.color = MUTED();
Chart.defaults.borderColor = GRID();

function baseTooltip() {
  return {
    enabled: true,
    backgroundColor: cssVar('--surface-raised'),
    titleColor: cssVar('--text-primary'),
    bodyColor: cssVar('--text-secondary'),
    borderColor: cssVar('--border-hairline-strong'),
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8,
    titleFont: { weight: '700', size: 12 },
    bodyFont: { size: 12 },
    displayColors: true,
    boxPadding: 4,
  };
}

export function lineChart(ctx, { labels, datasets, yLabel, suggestedMax, yStep } = {}) {
  const plugins = [];
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map(ds => ({
        borderWidth: 2,
        tension: 0.3,
        pointRadius: ds.data.length > 20 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: ds.color,
        pointBorderColor: ds.color,
        borderCapStyle: 'round',
        fill: false,
        borderColor: ds.color,
        backgroundColor: ds.color,
        spanGaps: true,
        ...ds,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: baseTooltip(),
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: MUTED(), font: { size: 10.5 }, maxRotation: 0, autoSkip: true },
          border: { color: cssVar('--baseline') },
        },
        y: {
          suggestedMax,
          grid: { color: GRID() },
          ticks: { color: MUTED(), font: { size: 10.5 }, stepSize: yStep, precision: 0 },
          border: { display: false },
          title: yLabel ? { display: true, text: yLabel, color: MUTED(), font: { size: 10.5 } } : undefined,
        },
      },
    },
  });
}

export function barChart(ctx, { labels, datasets, yLabel, suggestedMax, stacked = false } = {}) {
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map(ds => ({
        borderRadius: 4,
        borderSkipped: false,
        backgroundColor: ds.color,
        maxBarThickness: 34,
        ...ds,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: baseTooltip(),
      },
      scales: {
        x: {
          stacked,
          grid: { display: false },
          ticks: { color: MUTED(), font: { size: 10.5 } },
          border: { color: cssVar('--baseline') },
        },
        y: {
          stacked,
          suggestedMax,
          grid: { color: GRID() },
          ticks: { color: MUTED(), font: { size: 10.5 } },
          border: { display: false },
          title: yLabel ? { display: true, text: yLabel, color: MUTED(), font: { size: 10.5 } } : undefined,
        },
      },
    },
  });
}

export function destroyChart(chart) {
  if (chart) chart.destroy();
}
