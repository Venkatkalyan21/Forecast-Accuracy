// app.js — Forecast Accuracy Evaluator
// Real-world dataset: Daily Minimum Temperatures in Melbourne (1981–1990)
// Source: https://raw.githubusercontent.com/jbrownlee/Datasets/master/daily-min-temperatures.csv

const DATASET_URL = 'https://raw.githubusercontent.com/jbrownlee/Datasets/master/daily-min-temperatures.csv';

// ─── Example Dataset (20 months of retail sales) ─────────────────────────────
const EXAMPLE_DATA = [
    { label: 'Jan-2022', value: 210.5 },
    { label: 'Feb-2022', value: 198.3 },
    { label: 'Mar-2022', value: 225.7 },
    { label: 'Apr-2022', value: 240.1 },
    { label: 'May-2022', value: 255.4 },
    { label: 'Jun-2022', value: 248.9 },
    { label: 'Jul-2022', value: 260.2 },
    { label: 'Aug-2022', value: 272.6 },
    { label: 'Sep-2022', value: 265.0 },
    { label: 'Oct-2022', value: 280.3 },
    { label: 'Nov-2022', value: 295.8 },
    { label: 'Dec-2022', value: 320.4 },
    { label: 'Jan-2023', value: 230.1 },
    { label: 'Feb-2023', value: 215.6 },
    { label: 'Mar-2023', value: 242.3 },
    { label: 'Apr-2023', value: 258.7 },
    { label: 'May-2023', value: 270.9 },
    { label: 'Jun-2023', value: 263.5 },
    { label: 'Jul-2023', value: 278.1 },
    { label: 'Aug-2023', value: 290.4 }
];

let lineChartInstance = null;
let barChartInstance  = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    showLoading(true);
    loadFromURL(DATASET_URL);

    // ── Explainer accordion ────────────────────────────────────────────────────
    const explainerBar     = document.getElementById('explainer-bar');
    const explainerToggle  = document.getElementById('explainer-toggle');
    explainerToggle.addEventListener('click', () => {
        const isOpen = explainerBar.classList.toggle('open');
        explainerToggle.setAttribute('aria-expanded', isOpen);
    });

    // ── Tooltip on metric ⓘ icons ─────────────────────────────────────────────
    const tooltipEl = document.getElementById('tooltip-popup');
    document.querySelectorAll('.metric-tooltip').forEach(icon => {
        icon.addEventListener('mouseenter', (e) => {
            tooltipEl.textContent = icon.dataset.tip;
            tooltipEl.classList.remove('hidden');
            positionTooltip(e, tooltipEl);
        });
        icon.addEventListener('mousemove', (e) => positionTooltip(e, tooltipEl));
        icon.addEventListener('mouseleave', () => tooltipEl.classList.add('hidden'));
    });

    // ── Manual Entry Modal ──────────────────────────────────────────────────────
    const modal     = document.getElementById('manual-modal');
    const openBtn   = document.getElementById('open-manual-modal');
    const closeBtn  = document.getElementById('close-manual-modal');
    const addRowBtn = document.getElementById('add-row-btn');
    const clearBtn  = document.getElementById('clear-rows-btn');
    const runBtn    = document.getElementById('run-manual-btn');

    function seedRows() {
        const tbody = document.getElementById('manual-tbody');
        tbody.innerHTML = '';
        for (let i = 1; i <= 10; i++) appendRow(i);
    }

    openBtn.addEventListener('click', () => {
        if (document.getElementById('manual-tbody').rows.length === 0) seedRows();
        modal.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

    addRowBtn.addEventListener('click', () => {
        const tbody = document.getElementById('manual-tbody');
        appendRow(tbody.rows.length + 1);
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('Clear all rows and start fresh?')) seedRows();
    });

    document.getElementById('load-example-btn').addEventListener('click', () => {
        const tbody = document.getElementById('manual-tbody');
        tbody.innerHTML = '';
        EXAMPLE_DATA.forEach((item, i) => {
            appendRow(i + 1);
            const row = tbody.rows[tbody.rows.length - 1];
            row.cells[1].querySelector('input').value = item.label;
            row.cells[2].querySelector('input').value = item.value;
        });
    });

    runBtn.addEventListener('click', () => {
        const tbody   = document.getElementById('manual-tbody');
        const data    = [];
        let hasError  = false;

        Array.from(tbody.rows).forEach((row, idx) => {
            const labelInput = row.cells[1].querySelector('input');
            const valueInput = row.cells[2].querySelector('input');
            const label      = labelInput.value.trim() || `Day ${idx + 1}`;
            const value      = parseFloat(valueInput.value);

            if (isNaN(value) || valueInput.value.trim() === '') {
                valueInput.style.borderColor = '#f87171';
                hasError = true;
            } else {
                valueInput.style.borderColor = '';
                data.push({ day: idx + 1, sales: value, label });
            }
        });

        if (hasError) {
            alert('⚠️ Some value cells are empty or invalid. Please fill in all numeric values (highlighted in red).');
            return;
        }
        if (data.length < 10) {
            alert('Please enter at least 10 rows of data to run the analysis.');
            return;
        }

        document.getElementById('dataset-name').textContent    = '✏️ Manually Entered Dataset';
        document.getElementById('dataset-source').textContent  = `${data.length} rows entered manually`;

        modal.classList.add('hidden');
        showLoading(true);
        setTimeout(() => runForecastingProject(data), 50);
    });

    // ── File Upload ────────────────────────────────────────────────────────────
    document.getElementById('csv-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        document.getElementById('dataset-name').textContent   = `📂 ${file.name}`;
        document.getElementById('dataset-source').textContent = 'Custom uploaded dataset';

        showLoading(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = parseCSV(event.target.result);
                if (data.length < 10) throw new Error('Dataset too small — please upload at least 10 rows.');
                runForecastingProject(data);
            } catch (err) {
                showLoading(false);
                alert('Error parsing your CSV: ' + err.message);
            }
        };
        reader.readAsText(file);
    });
});

// ─── Load Remote Dataset ───────────────────────────────────────────────────────
async function loadFromURL(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Could not fetch remote dataset.');
        const text = await response.text();
        runForecastingProject(parseCSV(text));
    } catch (err) {
        console.warn('Remote fetch failed, using inline fallback data:', err.message);
        const fallback = `Day,Sales
1,205.1\n2,210.5\n3,212.3\n4,218.0\n5,221.7\n6,225.4\n7,227.1\n8,220.5\n9,218.1\n10,215.3
11,210.0\n12,208.5\n13,205.2\n14,203.4\n15,200.1\n16,201.5\n17,205.3\n18,208.7\n19,215.1\n20,218.9
21,225.0\n22,230.1\n23,235.5\n24,240.2\n25,242.1\n26,245.5\n27,248.0\n28,245.3\n29,240.1\n30,235.0
31,230.1\n32,228.5\n33,225.0\n34,222.1\n35,220.5\n36,218.9\n37,220.1\n38,222.5\n39,228.0\n40,235.1
41,240.5\n42,245.0\n43,250.2\n44,255.1\n45,260.5\n46,262.0\n47,265.1\n48,260.5\n49,255.0\n50,250.1`;
        document.getElementById('dataset-name').textContent    = 'Sample Sales Dataset (offline fallback)';
        document.getElementById('dataset-source').textContent  = 'Remote fetch failed — using built-in demo data';
        runForecastingProject(parseCSV(fallback));
    }
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
    const rows = text.trim().split('\n').slice(1);
    const data = [];
    rows.forEach((row, index) => {
        const parts = row.split(',');
        if (parts.length < 2) return;
        const value = parseFloat(parts[1].trim());
        if (!isNaN(value)) {
            data.push({ day: index + 1, sales: value, label: parts[0].trim() });
        }
    });
    return data;
}

// ─── Main Forecasting Engine ──────────────────────────────────────────────────
function runForecastingProject(data) {
    // 1. Train / Test Split — 80 / 20
    const splitIndex = Math.floor(data.length * 0.8);
    const trainData  = data.slice(0, splitIndex);
    const testData   = data.slice(splitIndex);

    // 2. Linear Regression (y = mx + b) fitted on training data
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = trainData.length;
    trainData.forEach(p => {
        sumX  += p.day;
        sumY  += p.sales;
        sumXY += p.day * p.sales;
        sumXX += p.day * p.day;
    });
    const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const b = (sumY - m * sumX) / n;

    // 3. Predict on test period
    const predictions = testData.map(p => ({
        day:       p.day,
        label:     p.label,
        actual:    p.sales,
        predicted: m * p.day + b
    }));

    // 4. Metrics
    let sumAE = 0, sumAPE = 0, sumSE = 0;
    const nTest = predictions.length;
    predictions.forEach(p => {
        const err = p.actual - p.predicted;
        sumAE  += Math.abs(err);
        sumAPE += Math.abs(err / p.actual);
        sumSE  += err * err;
    });
    const mae  = sumAE / nTest;
    const mape = (sumAPE / nTest) * 100;
    const rmse = Math.sqrt(sumSE / nTest);

    // 5. Unit label guess (temperature vs. generic value)
    const avgVal  = trainData.reduce((s, d) => s + d.sales, 0) / trainData.length;
    const unitHint = (avgVal > 0 && avgVal < 50) ? '°C' : '';

    // 6. Animate metric values into the cards
    showLoading(false);
    animateValue('val-mae',  mae,  3, unitHint);
    animateValue('val-mape', mape, 2, '%');
    animateValue('val-rmse', rmse, 3, unitHint);

    // 7. Plain-English sub-labels
    updatePlainText(mae, mape, rmse, unitHint, nTest);

    // 8. Performance badge on MAPE card
    updatePerformanceBadge(mape);

    // 9. Insight panel
    updateInsightPanel(mae, mape, rmse, unitHint, trainData.length, nTest);

    // 10. Charts
    renderLineChart(trainData, predictions);
    renderBarChart(mae, rmse, unitHint);
}

// ─── Animate counting numbers ─────────────────────────────────────────────────
function animateValue(elId, target, decimals, suffix) {
    const el    = document.getElementById(elId);
    const start = 0;
    const dur   = 900; // ms
    const startTime = performance.now();

    function update(now) {
        const t        = Math.min((now - startTime) / dur, 1);
        const eased    = 1 - Math.pow(1 - t, 3);          // ease-out cubic
        const current  = start + (target - start) * eased;
        el.innerText   = current.toFixed(decimals) + suffix;
        if (t < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// ─── Plain-English sub-labels ────────────────────────────────────────────────
function updatePlainText(mae, mape, rmse, unit, nTest) {
    const u = unit || 'units';

    // MAE plain text
    document.getElementById('plain-mae').innerHTML =
        `On average the model is off by <strong>${mae.toFixed(2)}${unit}</strong> per prediction.`;

    // MAPE plain text
    const mapeLabel = mape < 10 ? 'very small error' : mape < 20 ? 'moderate error' : 'large error';
    document.getElementById('plain-mape').innerHTML =
        `Each prediction deviates by about <strong>${mape.toFixed(1)}%</strong> from reality — a ${mapeLabel}.`;

    // RMSE plain text
    const gap = rmse - mae;
    const gapNote = gap < mae * 0.2
        ? 'close to MAE → errors are consistent'
        : 'higher than MAE → a few predictions were badly wrong';
    document.getElementById('plain-rmse').innerHTML =
        `RMSE is <strong>${rmse.toFixed(2)}${unit}</strong> — ${gapNote}.`;
}

// ─── Performance badge (on MAPE card) ────────────────────────────────────────
function updatePerformanceBadge(mape) {
    const badge = document.getElementById('perf-badge');
    if (mape < 10) {
        badge.textContent = '🟢 Excellent  (< 10%)';
        badge.className   = 'performance-badge excellent';
    } else if (mape < 15) {
        badge.textContent = '🟡 Good  (10–15%)';
        badge.className   = 'performance-badge good';
    } else if (mape < 25) {
        badge.textContent = '🟠 Fair  (15–25%)';
        badge.className   = 'performance-badge fair';
    } else {
        badge.textContent = '🔴 Poor  (> 25%)';
        badge.className   = 'performance-badge poor';
    }
}

// ─── Insight Panel ────────────────────────────────────────────────────────────
function updateInsightPanel(mae, mape, rmse, unit, nTrain, nTest) {
    const u = unit || '';

    let rating, ratingEmoji, summary, detail;

    if (mape < 10) {
        rating      = 'Excellent';
        ratingEmoji = '🎉';
        summary     = `The model is performing <strong>excellently</strong> with a MAPE of just ${mape.toFixed(1)}%.`;
        detail      = `For every prediction, the average percentage error is only ${mape.toFixed(1)}%. `
                    + `That means if the real value is 100, the model typically guesses between ${(100 - mape).toFixed(0)} and ${(100 + mape).toFixed(0)}.`;
    } else if (mape < 15) {
        rating      = 'Good';
        ratingEmoji = '👍';
        summary     = `The model is performing <strong>well</strong> with a MAPE of ${mape.toFixed(1)}%.`;
        detail      = `Errors average around ${mape.toFixed(1)}% of the actual value. `
                    + `This is reasonable for a simple linear regression model.`;
    } else if (mape < 25) {
        rating      = 'Fair';
        ratingEmoji = '⚠️';
        summary     = `The model is performing <strong>fairly</strong> with a MAPE of ${mape.toFixed(1)}%.`;
        detail      = `Errors are noticeable. The data may have seasonality or patterns that a straight line can't capture. `
                    + `Try a more advanced model (e.g. moving average or ARIMA) for better results.`;
    } else {
        rating      = 'Poor';
        ratingEmoji = '❌';
        summary     = `The model is <strong>struggling</strong> with a MAPE of ${mape.toFixed(1)}%.`;
        detail      = `A ${mape.toFixed(0)}% average error means predictions can be very far from reality. `
                    + `Linear regression may be the wrong model for this data — consider a non-linear approach.`;
    }

    const gapRatio = (rmse - mae) / mae;
    const outlierNote = gapRatio > 0.5
        ? ` Note: RMSE (${rmse.toFixed(2)}${u}) is significantly higher than MAE (${mae.toFixed(2)}${u}), suggesting a few predictions were <strong>especially bad</strong> — worth investigating.`
        : ` RMSE and MAE are close together, suggesting errors are fairly consistent across all predictions — <strong>no major outliers</strong>.`;

    document.getElementById('insight-text').innerHTML = `
        <h3>${ratingEmoji} Model Insights — ${rating}</h3>
        <p>${summary} Trained on <strong>${nTrain} data points</strong>, tested on <strong>${nTest} data points</strong>.</p>
        <p style="margin-top:0.5rem">${detail}${outlierNote}</p>
    `;
}

// ─── Line Chart ───────────────────────────────────────────────────────────────
function renderLineChart(trainData, testPredictions) {
    if (lineChartInstance) { lineChartInstance.destroy(); lineChartInstance = null; }

    const ctx          = document.getElementById('lineChart').getContext('2d');
    const visibleTrain = trainData.slice(-200);
    const labels       = [
        ...visibleTrain.map(d => d.label || d.day),
        ...testPredictions.map(d => d.label || d.day)
    ];
    const trainPoints   = visibleTrain.map(d => d.sales);
    const padding       = new Array(visibleTrain.length).fill(null);
    const actualTest    = [...padding, ...testPredictions.map(d => d.actual)];
    const predictedTest = [...padding, ...testPredictions.map(d => d.predicted)];

    lineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: '🔵 Training Data (not predicted)',
                    data:         trainPoints,
                    borderColor:  'rgba(148,163,184,0.35)',
                    backgroundColor: 'transparent',
                    borderWidth:  1.5,
                    pointRadius:  0,
                    tension:      0.25
                },
                {
                    label: '🔵 Actual Test Values',
                    data:            actualTest,
                    borderColor:     '#60a5fa',
                    backgroundColor: 'rgba(96,165,250,0.1)',
                    fill:            true,
                    borderWidth:     2.5,
                    pointRadius:     3,
                    pointHoverRadius: 5,
                    tension:         0.25
                },
                {
                    label: '🔴 Model Prediction (Linear Regression)',
                    data:            predictedTest,
                    borderColor:     '#f87171',
                    backgroundColor: 'transparent',
                    borderWidth:     2.5,
                    borderDash:      [7, 4],
                    pointRadius:     3,
                    pointHoverRadius: 5,
                    tension:         0.25
                }
            ]
        },
        options: {
            responsive: true,
            animation:  { duration: 1000, easing: 'easeInOutQuart' },
            plugins: {
                legend: {
                    labels: {
                        color:  '#94a3b8',
                        font:   { family: 'Outfit', size: 12 },
                        boxWidth: 18,
                        padding:  16
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label.replace(/^[🔵🔴]\s/, '')}: ${ctx.parsed.y?.toFixed(3) ?? 'n/a'}`
                    }
                }
            },
            scales: {
                x: {
                    grid:  { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#475569', maxTicksLimit: 10, font: { size: 11 } },
                    title: { display: true, text: '← Training period  |  Test period →', color: '#475569', font: { size: 11 } }
                },
                y: {
                    grid:  { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#475569' },
                    title: { display: true, text: 'Value', color: '#475569' }
                }
            }
        }
    });
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function renderBarChart(mae, rmse, unit) {
    if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }

    const ctx = document.getElementById('barChart').getContext('2d');

    // Gradient fills
    const blueGrad = ctx.createLinearGradient(0, 0, 0, 280);
    blueGrad.addColorStop(0, 'rgba(96,165,250,0.9)');
    blueGrad.addColorStop(1, 'rgba(96,165,250,0.35)');

    const redGrad = ctx.createLinearGradient(0, 0, 0, 280);
    redGrad.addColorStop(0, 'rgba(248,113,113,0.9)');
    redGrad.addColorStop(1, 'rgba(248,113,113,0.35)');

    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['MAE\n(avg error)', 'RMSE\n(penalises outliers)'],
            datasets: [{
                label: `Error (${unit || 'units'})`,
                data:            [mae, rmse],
                backgroundColor: [blueGrad, redGrad],
                borderColor:     ['#60a5fa', '#f87171'],
                borderWidth:     1.5,
                borderRadius:    10,
                borderSkipped:   false
            }]
        },
        options: {
            responsive: true,
            animation:  { duration: 1000, easing: 'easeInOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y.toFixed(4)} ${unit || 'units'}`
                    }
                }
            },
            scales: {
                x: {
                    grid:  { display: false },
                    ticks: {
                        color:  '#94a3b8',
                        font:   { size: 13, weight: '700', family: 'Outfit' }
                    }
                },
                y: {
                    grid:  { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#475569' },
                    title: {
                        display: true,
                        text:    `← Lower is better`,
                        color:   '#475569',
                        font:    { size: 11 }
                    }
                }
            }
        }
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.toggle('hidden', !show);
}

function positionTooltip(e, el) {
    const pad  = 12;
    const left = Math.min(e.clientX + pad, window.innerWidth - el.offsetWidth - pad);
    const top  = e.clientY - el.offsetHeight - pad;
    el.style.left = left + 'px';
    el.style.top  = (top < 0 ? e.clientY + pad : top) + 'px';
}

function appendRow(rowNumber) {
    const tbody = document.getElementById('manual-tbody');
    const tr    = document.createElement('tr');
    tr.innerHTML = `
        <td>${rowNumber}</td>
        <td><input type="text"   placeholder="e.g. Jan-2024 or Day ${rowNumber}"></td>
        <td><input type="number" step="any" placeholder="e.g. 245.5"></td>
        <td>
            <button class="delete-row-btn" title="Delete row">✕</button>
        </td>
    `;

    tr.querySelector('.delete-row-btn').addEventListener('click', () => {
        tr.remove();
        Array.from(tbody.rows).forEach((r, i) => { r.cells[0].textContent = i + 1; });
    });

    tr.querySelector('input[type="number"]').addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !e.shiftKey) {
            const rows = tbody.rows;
            if (tr === rows[rows.length - 1]) {
                e.preventDefault();
                appendRow(rows.length + 1);
                tbody.rows[tbody.rows.length - 1].cells[1].querySelector('input').focus();
            }
        }
    });

    tbody.appendChild(tr);
}
