// app.js — Forecast Evaluation Dashboard
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

// Keep chart instances so we can destroy & re-render on new uploads
let lineChartInstance = null;
let barChartInstance = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    showLoading(true);
    loadFromURL(DATASET_URL);

    // ── Manual Entry Modal ──────────────────────────────────────────────────────
    const modal      = document.getElementById('manual-modal');
    const openBtn    = document.getElementById('open-manual-modal');
    const closeBtn   = document.getElementById('close-manual-modal');
    const addRowBtn  = document.getElementById('add-row-btn');
    const clearBtn   = document.getElementById('clear-rows-btn');
    const runBtn     = document.getElementById('run-manual-btn');

    // Seed with 10 empty rows on first open
    function seedRows() {
        const tbody = document.getElementById('manual-tbody');
        tbody.innerHTML = '';
        for (let i = 1; i <= 10; i++) appendRow(i);
    }

    // Open
    openBtn.addEventListener('click', () => {
        if (document.getElementById('manual-tbody').rows.length === 0) seedRows();
        modal.classList.remove('hidden');
    });

    // Close (X button or click outside modal box)
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    // Add Row
    addRowBtn.addEventListener('click', () => {
        const tbody = document.getElementById('manual-tbody');
        appendRow(tbody.rows.length + 1);
    });

    // Clear All
    clearBtn.addEventListener('click', () => {
        if (confirm('Clear all rows and start fresh?')) seedRows();
    });

    // Load Example Data
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

    // Run Analysis
    runBtn.addEventListener('click', () => {
        const tbody = document.getElementById('manual-tbody');
        const data = [];
        let hasError = false;

        Array.from(tbody.rows).forEach((row, idx) => {
            const labelInput = row.cells[1].querySelector('input');
            const valueInput = row.cells[2].querySelector('input');
            const label = labelInput.value.trim() || `Day ${idx + 1}`;
            const value = parseFloat(valueInput.value);

            // Highlight bad cells
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

        // Update the banner to reflect manual data
        document.getElementById('dataset-name').textContent = '✏️ Manually Entered Dataset';
        document.getElementById('dataset-source').textContent = `${data.length} rows entered manually`;

        modal.classList.add('hidden');
        showLoading(true);
        // Small timeout so spinner renders before heavy chart work
        setTimeout(() => runForecastingProject(data), 50);
    });


    // File Upload handler
    document.getElementById('csv-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Update the dataset name badge in the banner
        document.getElementById('dataset-name').textContent = `📂 ${file.name}`;
        document.getElementById('dataset-source').textContent = 'Custom uploaded dataset';

        showLoading(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = parseCSV(event.target.result);
                if (data.length < 10) {
                    throw new Error("Dataset too small — please upload at least 10 rows.");
                }
                runForecastingProject(data);
            } catch (err) {
                showLoading(false);
                alert("Error parsing your CSV: " + err.message);
            }
        };
        reader.readAsText(file);
    });
});

// ─── Load Remote Dataset ───────────────────────────────────────────────────────
async function loadFromURL(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Could not fetch remote dataset.");
        const text = await response.text();
        const data = parseCSV(text);
        runForecastingProject(data);
    } catch (err) {
        console.warn("Remote fetch failed, using inline fallback data:", err.message);
        // Fallback: inline 50-row sales dataset if network is unavailable
        const fallback = `Day,Sales
1,205.1\n2,210.5\n3,212.3\n4,218.0\n5,221.7\n6,225.4\n7,227.1\n8,220.5\n9,218.1\n10,215.3
11,210.0\n12,208.5\n13,205.2\n14,203.4\n15,200.1\n16,201.5\n17,205.3\n18,208.7\n19,215.1\n20,218.9
21,225.0\n22,230.1\n23,235.5\n24,240.2\n25,242.1\n26,245.5\n27,248.0\n28,245.3\n29,240.1\n30,235.0
31,230.1\n32,228.5\n33,225.0\n34,222.1\n35,220.5\n36,218.9\n37,220.1\n38,222.5\n39,228.0\n40,235.1
41,240.5\n42,245.0\n43,250.2\n44,255.1\n45,260.5\n46,262.0\n47,265.1\n48,260.5\n49,255.0\n50,250.1`;
        document.getElementById('dataset-name').textContent = 'Sample Sales Dataset (offline fallback)';
        document.getElementById('dataset-source').textContent = 'Remote fetch failed — using built-in demo data';
        const data = parseCSV(fallback);
        runForecastingProject(data);
    }
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
// Parses any 2-column CSV. First column = label/index, Second column = numeric value.
function parseCSV(text) {
    const rows = text.trim().split('\n').slice(1); // skip header row
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
    // 1. Train-Test Split (80% Train, 20% Test)
    const splitIndex = Math.floor(data.length * 0.8);
    const trainData = data.slice(0, splitIndex);
    const testData = data.slice(splitIndex);

    // 2. Linear Regression — y = mx + b — fitted on training data
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = trainData.length;
    trainData.forEach(p => {
        sumX += p.day;
        sumY += p.sales;
        sumXY += p.day * p.sales;
        sumXX += p.day * p.day;
    });
    const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const b = (sumY - m * sumX) / n;

    // 3. Generate predictions for test period
    const predictions = testData.map(p => ({
        day: p.day,
        label: p.label,
        actual: p.sales,
        predicted: m * p.day + b
    }));

    // 4. Evaluation Metrics
    let sumAE = 0, sumAPE = 0, sumSE = 0;
    const nTest = predictions.length;
    predictions.forEach(p => {
        const error = p.actual - p.predicted;
        sumAE  += Math.abs(error);
        sumAPE += Math.abs(error / p.actual);
        sumSE  += error * error;
    });
    const mae  = sumAE / nTest;
    const mape = (sumAPE / nTest) * 100;
    const rmse = Math.sqrt(sumSE / nTest);

    // 5. Update UI metric cards
    document.getElementById('val-mae').innerText  = mae.toFixed(3);
    document.getElementById('val-mape').innerText = mape.toFixed(2) + '%';
    document.getElementById('val-rmse').innerText = rmse.toFixed(3);

    showLoading(false);

    // 6. Render charts
    renderLineChart(trainData, predictions);
    renderBarChart(mae, rmse);
}

// ─── Line Chart: Actual vs Predicted ─────────────────────────────────────────
function renderLineChart(trainData, testPredictions) {
    // Destroy old chart if it exists
    if (lineChartInstance) { lineChartInstance.destroy(); lineChartInstance = null; }

    const ctx = document.getElementById('lineChart').getContext('2d');

    // Use only the last 200 training points for readability on large datasets
    const visibleTrain = trainData.slice(-200);
    const labels = [
        ...visibleTrain.map(d => d.label || d.day),
        ...testPredictions.map(d => d.label || d.day)
    ];
    const trainPoints  = visibleTrain.map(d => d.sales);
    const padding      = new Array(visibleTrain.length).fill(null);
    const actualTest   = [...padding, ...testPredictions.map(d => d.actual)];
    const predictedTest = [...padding, ...testPredictions.map(d => d.predicted)];

    lineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Training Data',
                    data: trainPoints,
                    borderColor: 'rgba(148, 163, 184, 0.4)',
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.2
                },
                {
                    label: 'Actual Test Data',
                    data: actualTest,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    fill: true,
                    borderWidth: 2.5,
                    pointRadius: 3,
                    tension: 0.2
                },
                {
                    label: 'Predicted (Linear Regression)',
                    data: predictedTest,
                    borderColor: '#f87171',
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    borderDash: [6, 4],
                    pointRadius: 3,
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            animation: { duration: 800, easing: 'easeInOutQuart' },
            plugins: {
                legend: { labels: { color: '#e2e8f0', font: { family: 'Outfit' } } }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#64748b', maxTicksLimit: 10, font: { size: 11 } },
                    title: { display: true, text: 'Time / Day', color: '#94a3b8' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#64748b' },
                    title: { display: true, text: 'Value', color: '#94a3b8' }
                }
            }
        }
    });
}

// ─── Bar Chart: MAE vs RMSE ───────────────────────────────────────────────────
function renderBarChart(mae, rmse) {
    if (barChartInstance) { barChartInstance.destroy(); barChartInstance = null; }

    const ctx = document.getElementById('barChart').getContext('2d');

    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['MAE', 'RMSE'],
            datasets: [{
                label: 'Error Value',
                data: [mae, rmse],
                backgroundColor: [
                    'rgba(96, 165, 250, 0.85)',
                    'rgba(248, 113, 113, 0.85)'
                ],
                borderColor: [
                    '#60a5fa',
                    '#f87171'
                ],
                borderWidth: 1,
                borderRadius: 8,
            }]
        },
        options: {
            responsive: true,
            animation: { duration: 800, easing: 'easeInOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y.toFixed(4)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 14, weight: '700', family: 'Outfit' } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#64748b' }
                }
            }
        }
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

// Creates one editable row in the manual entry table
function appendRow(rowNumber) {
    const tbody = document.getElementById('manual-tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${rowNumber}</td>
        <td><input type="text" placeholder="e.g. Jan-2024 or Day ${rowNumber}"></td>
        <td><input type="number" step="any" placeholder="e.g. 245.5"></td>
        <td>
            <button class="delete-row-btn" title="Delete row">✕</button>
        </td>
    `;

    // Delete button — remove row and re-number
    tr.querySelector('.delete-row-btn').addEventListener('click', () => {
        tr.remove();
        // Re-number remaining rows
        Array.from(tbody.rows).forEach((r, i) => {
            r.cells[0].textContent = i + 1;
        });
    });

    // Tab from last value cell → auto-add new row
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
