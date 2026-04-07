/* ============================================================
   HUB DA POS - app.js
   Refatorado com sistema de filtros globais combinaveis
   ============================================================ */

let DATA = null;
const chartInstances = {};
const ROWS_PER_PAGE = 50;

const COLORS = [
    '#1e88e5','#2e7d32','#00838f','#ef6c00','#6a1b9a','#ad1457',
    '#f9a825','#d84315','#0277bd','#558b2f','#4527a0','#c62828',
    '#1565c0','#33691e','#00695c','#4e342e','#37474f','#7b1fa2',
    '#e65100','#01579b','#880e4f','#311b92','#004d40','#bf360c'
];

function toTitleCase(str) {
    if (!str) return '';
    const lowers = ['de','da','do','das','dos','e','em','a','o','as','os','na','no'];
    return str.toLowerCase().split(' ').map((w, i) =>
        i === 0 || !lowers.includes(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
    ).join(' ');
}

/* ============================================================
   GLOBAL FILTER STATE
   ============================================================ */
const GF = {
    programa: '',
    tipo:     '',
    ano:      '',
    keyword:  ''
};

/* Apply global filters to an array of items.
   Each item must expose normalized fields for matching.
   Accepts items from pesq, ext, ppg, profProfiles. */
function filterData(items, type) {
    if (!items || items.length === 0) return items;
    const kw = GF.keyword.toLowerCase().trim();
    const hasFilters = GF.programa || GF.tipo || GF.ano || kw;
    if (!hasFilters) return items;

    return items.filter(item => {
        // Tipo filter
        if (GF.tipo && GF.tipo !== type) return false;

        // Ano filter
        if (GF.ano) {
            const itemYear = String(item.y || item.yr || '');
            if (itemYear !== GF.ano) return false;
        }

        // Programa filter
        if (GF.programa) {
            if (type === 'pesquisa') {
                // Match by coordenador SIAPE -> find their PPG
                const prof = DATA.profProfiles[item.s];
                if (!prof || !prof.ppg || !prof.ppg.includes(GF.programa)) return false;
            } else if (type === 'extensao') {
                const prof = DATA.profProfiles[item.s];
                if (!prof || !prof.ppg || !prof.ppg.includes(GF.programa)) return false;
            } else if (type === 'ppg') {
                if (item.sg !== GF.programa) return false;
            } else if (type === 'docentes') {
                if (!item.ppg || !item.ppg.includes(GF.programa)) return false;
            }
        }

        // Keyword filter - search across all string fields
        if (kw) {
            const allText = Object.values(item)
                .filter(v => typeof v === 'string')
                .join(' ')
                .toLowerCase();
            if (!allText.includes(kw)) return false;
        }

        return true;
    });
}

/* Count active filters */
function countActiveFilters() {
    return [GF.programa, GF.tipo, GF.ano, GF.keyword].filter(v => v).length;
}

/* Build active filter badges in sidebar */
function renderActiveFilterBadges() {
    const bar = document.getElementById('active-filters-bar');
    if (!bar) return;
    bar.innerHTML = '';
    const badges = [];
    if (GF.programa) badges.push({ key: 'programa', label: 'Prog: ' + GF.programa });
    if (GF.tipo)     badges.push({ key: 'tipo',     label: 'Tipo: ' + GF.tipo });
    if (GF.ano)      badges.push({ key: 'ano',      label: 'Ano: ' + GF.ano });
    if (GF.keyword)  badges.push({ key: 'keyword',  label: '"' + GF.keyword + '"' });

    badges.forEach(b => {
        const div = document.createElement('div');
        div.className = 'af-badge';
        div.innerHTML = `${b.label} <span class="af-x">&#10005;</span>`;
        div.addEventListener('click', () => {
            GF[b.key] = '';
            syncFilterUI();
            applyGlobalFilters();
        });
        bar.appendChild(div);
    });
}

/* Sync UI inputs to GF state (used after programmatic reset) */
function syncFilterUI() {
    document.getElementById('gf-programa').value = GF.programa;
    document.getElementById('gf-tipo').value     = GF.tipo;
    document.getElementById('gf-ano').value      = GF.ano;
    document.getElementById('gf-keyword').value  = GF.keyword;
}

/* Show/hide filter result banner on current page */
function showFilterBanner(containerId, total, filtered) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (countActiveFilters() > 0) {
        el.classList.add('visible');
        el.innerHTML = `Filtros ativos: mostrando <span>${filtered.toLocaleString('pt-BR')}</span> de ${total.toLocaleString('pt-BR')} registros`;
    } else {
        el.classList.remove('visible');
    }
}

/* Master function: re-renders whatever page is currently active */
function applyGlobalFilters() {
    renderActiveFilterBadges();
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    const pageId = activePage.id;
    switch (pageId) {
        case 'visao-geral':      renderVisaoGeralFiltered(); break;
        case 'pesquisa':         renderPesqFiltered(); break;
        case 'extensao':         renderExtFiltered(); break;
        case 'docentes':         renderDocentesFiltered(); break;
        default: break; // other pages handle their own local filters
    }
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const resp = await fetch('data.json');
        DATA = await resp.json();
        console.log('Data loaded:', Object.keys(DATA));
        // Sort PPG lists alphabetically by full name for all dropdowns/tables
        if (DATA.ppgAnalysis) DATA.ppgAnalysis.sort((a, b) => a.nm.localeCompare(b.nm, 'pt-BR'));
        if (DATA.ppg)         DATA.ppg.sort((a, b) => (a.nm || '').localeCompare(b.nm || '', 'pt-BR'));
        setupNavigation();
        setupGlobalFilters();
        setupModalEvents();
        initVisaoGeral();
    } catch(e) {
        console.error('Failed to load data:', e);
        document.getElementById('content').innerHTML =
            '<div class="loading-msg">Erro ao carregar dados. Verifique se data.json está no mesmo diretório.</div>';
    }
});

/* ============================================================
   GLOBAL FILTER SETUP
   ============================================================ */
function setupGlobalFilters() {
    // Populate programa select
    const progSel = document.getElementById('gf-programa');
    DATA.ppgAnalysis.forEach(p => {
        const o = document.createElement('option');
        o.value = p.sg;
        const nmTitle = p.nm.charAt(0) + p.nm.slice(1).toLowerCase().replace(/(e|de|da|do|das|dos|em|a|o|as|os)/g, w => w).replace(/pro[- ]/gi, m => m.toUpperCase());
        o.textContent = `${p.sg} — Prog. Pós-Grad. em ${nmTitle} (${p.cp})`;
        progSel.appendChild(o);
    });

    // Populate ano select
    const anoSel = document.getElementById('gf-ano');
    const allYears = [...new Set([
        ...Object.keys(DATA.pesqYear || {}),
        ...Object.keys(DATA.extYear  || {})
    ])].filter(y => y).sort();
    allYears.forEach(y => {
        const o = document.createElement('option');
        o.value = y; o.textContent = y;
        anoSel.appendChild(o);
    });

    // Event listeners
    progSel.addEventListener('change', () => { GF.programa = progSel.value; applyGlobalFilters(); });
    document.getElementById('gf-tipo').addEventListener('change', (e) => { GF.tipo = e.target.value; applyGlobalFilters(); });
    anoSel.addEventListener('change',  () => { GF.ano = anoSel.value; applyGlobalFilters(); });

    let kwTimer;
    document.getElementById('gf-keyword').addEventListener('input', (e) => {
        clearTimeout(kwTimer);
        kwTimer = setTimeout(() => { GF.keyword = e.target.value; applyGlobalFilters(); }, 300);
    });

    document.getElementById('gf-clear').addEventListener('click', () => {
        GF.programa = ''; GF.tipo = ''; GF.ano = ''; GF.keyword = '';
        syncFilterUI();
        applyGlobalFilters();
    });
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const page = link.dataset.page;
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(page).classList.add('active');
            initPage(page);
            // Re-apply filters on page switch
            setTimeout(() => applyGlobalFilters(), 50);
        });
    });
}

const initializedPages = {};
function initPage(page) {
    if (initializedPages[page]) return;
    initializedPages[page] = true;
    switch(page) {
        case 'visao-geral':       initVisaoGeral();       break;
        case 'pesquisa':          initPesquisa();         break;
        case 'extensao':          initExtensao();         break;
        case 'ppg':               initPPG();              break;
        case 'docentes':          initDocentes();         break;
        case 'sankey':            initSankey();           break;
        case 'analise-ppg':       initAnalisePPG();       break;
        case 'analise-docentes':  initAnaliseDocentes();  break;
    }
}

/* ============================================================
   UTILITY
   ============================================================ */
function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}
function createChart(canvasId, config) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    chartInstances[canvasId] = new Chart(ctx.getContext('2d'), config);
    return chartInstances[canvasId];
}
function makeStatCard(value, label) {
    const d = document.createElement('div');
    d.className = 'stat-card';
    d.innerHTML = `<div class="stat-value">${Number(value).toLocaleString('pt-BR')}</div><div class="stat-label">${label}</div>`;
    return d;
}
function renderWordCloud(containerId, words, maxWords) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const subset = (words || []).slice(0, maxWords || 80);
    if (!subset.length) { container.innerHTML = '<p style="color:#aaa;padding:20px">Sem dados</p>'; return; }
    const maxC = Math.max(...subset.map(w => w.c));
    const minC = Math.min(...subset.map(w => w.c));
    const colors = ['#1e88e5','#2e7d32','#00838f','#ef6c00','#ad1457','#6a1b9a','#f9a825','#d84315','#0277bd','#558b2f'];
    subset.forEach((item, i) => {
        const ratio = maxC === minC ? 0.5 : (item.c - minC) / (maxC - minC);
        const size = 12 + ratio * 34;
        const span = document.createElement('span');
        span.className = 'wc-word';
        span.textContent = item.w;
        span.title = `${item.w}: ${item.c}`;
        span.style.fontSize = size + 'px';
        span.style.color = colors[i % colors.length];
        span.style.opacity = 0.65 + ratio * 0.35;
        container.appendChild(span);
    });
}
function paginate(data, page, perPage) {
    return data.slice((page - 1) * perPage, page * perPage);
}
function renderPagination(containerId, totalItems, currentPage, perPage, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const totalPages = Math.ceil(totalItems / perPage);
    if (totalPages <= 1) return;
    const maxButtons = 10;
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end   = Math.min(totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);

    if (currentPage > 1) {
        const b = document.createElement('button');
        b.textContent = 'Anterior';
        b.onclick = () => callback(currentPage - 1);
        container.appendChild(b);
    }
    for (let i = start; i <= end; i++) {
        const b = document.createElement('button');
        b.textContent = i;
        if (i === currentPage) b.className = 'active';
        b.onclick = () => callback(i);
        container.appendChild(b);
    }
    if (currentPage < totalPages) {
        const b = document.createElement('button');
        b.textContent = 'Proximo';
        b.onclick = () => callback(currentPage + 1);
        container.appendChild(b);
    }
}
function setCountTag(id, n, total) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = n === total ? `${total} registros` : `${n} / ${total}`;
}

/* ============================================================
   VISAO GERAL
   ============================================================ */
function initVisaoGeral() {
    renderVisaoGeralFiltered();
}

function renderVisaoGeralFiltered() {
    const s = DATA.stats;
    const pesqFiltered = filterData(DATA.pesq, 'pesquisa');
    const extFiltered  = filterData(DATA.ext,  'extensao');
    const hasFilter    = countActiveFilters() > 0;

    // Stats cards
    const grid = document.getElementById('stats-cards');
    grid.innerHTML = '';
    if (hasFilter) {
        grid.appendChild(makeStatCard(pesqFiltered.length, 'Registros de Pesquisa (filtrado)'));
        grid.appendChild(makeStatCard(extFiltered.length,  'Ações de Extensão (filtrado)'));
        const docsInFilter = new Set([
            ...pesqFiltered.map(p => p.s),
            ...extFiltered.map(e => e.s)
        ]);
        grid.appendChild(makeStatCard(docsInFilter.size, 'Docentes envolvidos'));
    } else {
        grid.appendChild(makeStatCard(s.total_docentes,  'Docentes'));
        grid.appendChild(makeStatCard(s.reg_pesq,        'Registros de Pesquisa'));
        grid.appendChild(makeStatCard(s.acoes_ext,       'Ações de Extensão'));
        grid.appendChild(makeStatCard(s.progs_ppg,       'Programas PPG'));
        grid.appendChild(makeStatCard(s.com_pesquisa,    'Docentes c/ Pesquisa'));
        grid.appendChild(makeStatCard(s.com_extensao,    'Docentes c/ Extensão'));
        grid.appendChild(makeStatCard(s.em_ppg,          'Docentes em PPG'));
        grid.appendChild(makeStatCard(s.tripla,          'Pesq+Ext+PPG'));
    }

    // Banner
    const totalAll = DATA.pesq.length + DATA.ext.length;
    const totalFiltered = pesqFiltered.length + extFiltered.length;
    showFilterBanner('global-filter-banner', totalAll, totalFiltered);

    // Chart: Pesquisa por ano (filtered)
    const pesqYearMap = {};
    pesqFiltered.forEach(p => { if (p.y) pesqYearMap[p.y] = (pesqYearMap[p.y] || 0) + 1; });
    const pesqYears = Object.keys(hasFilter ? pesqYearMap : DATA.pesqYear).sort();
    createChart('chart-pesq-ano', {
        type: 'bar',
        data: {
            labels: pesqYears,
            datasets: [{
                label: 'Registros de Pesquisa',
                data: pesqYears.map(y => hasFilter ? (pesqYearMap[y] || 0) : DATA.pesqYear[y]),
                backgroundColor: '#1e88e5',
                borderRadius: 6
            }]
        },
        options: chartOpts(false)
    });

    // Chart: Extensao por ano (filtered)
    const extYearMap = {};
    extFiltered.forEach(e => { if (e.y) extYearMap[e.y] = (extYearMap[e.y] || 0) + 1; });
    const extYears = Object.keys(hasFilter ? extYearMap : DATA.extYear).filter(y => y).sort();
    createChart('chart-ext-ano', {
        type: 'bar',
        data: {
            labels: extYears,
            datasets: [{
                label: 'Ações de Extensão',
                data: extYears.map(y => hasFilter ? (extYearMap[y] || 0) : DATA.extYear[y]),
                backgroundColor: '#2e7d32',
                borderRadius: 6
            }]
        },
        options: chartOpts(false)
    });

    // Static charts (not filtered)
    createChart('chart-doc-perfil', {
        type: 'doughnut',
        data: {
            labels: ['Só Pesquisa','Só Extensão','Pesq+Ext','Pesq+PPG','Ext+PPG','Pesq+Ext+PPG','Sem registro'],
            datasets: [{
                data: [
                    s.com_pesquisa - s.pesq_ext - s.pesq_ppg + s.tripla,
                    s.com_extensao - s.pesq_ext - s.ext_ppg + s.tripla,
                    s.pesq_ext - s.tripla,
                    s.pesq_ppg - s.tripla,
                    s.ext_ppg - s.tripla,
                    s.tripla,
                    s.total_docentes - (s.com_pesquisa + s.com_extensao + s.em_ppg - s.pesq_ext - s.pesq_ppg - s.ext_ppg + s.tripla)
                ],
                backgroundColor: COLORS.slice(0, 7)
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } }
    });

    const campusLabels = Object.keys(DATA.ppgCampus);
    createChart('chart-ppg-campus', {
        type: 'bar',
        data: {
            labels: campusLabels,
            datasets: [{
                label: 'Programas',
                data: campusLabels.map(c => DATA.ppgCampus[c]),
                backgroundColor: '#43a047',
                borderRadius: 6
            }]
        },
        options: { ...chartOpts(false), indexAxis: 'y' }
    });
}

/* Shared chart options */
function chartOpts(showLegend) {
    return {
        responsive: true,
        plugins: { legend: { display: showLegend } },
        scales: { y: { beginAtZero: true } }
    };
}

/* ============================================================
   PESQUISA
   ============================================================ */
let pesqPage = 1;
let pesqLocalSearch = '';
let pesqLocalYear = '';

function initPesquisa() {
    const pesqYears = Object.keys(DATA.pesqYear).sort();
    createChart('chart-pesq-ano2', {
        type: 'bar',
        data: {
            labels: pesqYears,
            datasets: [{ label: 'Registros', data: pesqYears.map(y => DATA.pesqYear[y]), backgroundColor: '#1e88e5', borderRadius: 6 }]
        },
        options: chartOpts(false)
    });

    const areas = DATA.topAreas.slice(0, 20);
    createChart('chart-top-areas', {
        type: 'bar',
        data: {
            labels: areas.map(a => a.a.length > 30 ? a.a.substring(0,30)+'...' : a.a),
            datasets: [{ label: 'Projetos', data: areas.map(a => a.c), backgroundColor: COLORS.slice(0, 20), borderRadius: 4 }]
        },
        options: {
            responsive: true, indexAxis: 'y',
            plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => areas[items[0].dataIndex].a } } },
            scales: { x: { beginAtZero: true } }
        }
    });

    renderWordCloud('wc-pesquisa', DATA.wordCloud, 80);

    const yearFilter = document.getElementById('pesq-year-filter');
    pesqYears.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; yearFilter.appendChild(o); });

    document.getElementById('pesq-search').addEventListener('input', (e)     => { pesqLocalSearch = e.target.value; pesqPage = 1; renderPesqFiltered(); });
    document.getElementById('pesq-year-filter').addEventListener('change', (e) => { pesqLocalYear  = e.target.value; pesqPage = 1; renderPesqFiltered(); });
    renderPesqFiltered();
}

function renderPesqFiltered() {
    let base = filterData(DATA.pesq, 'pesquisa');

    // Additional local filters
    if (pesqLocalYear) base = base.filter(p => p.y === pesqLocalYear);
    if (pesqLocalSearch) {
        const kw = pesqLocalSearch.toLowerCase();
        base = base.filter(p => `${p.c} ${p.t} ${p.a} ${p.n} ${p.dp}`.toLowerCase().includes(kw));
    }

    const total = DATA.pesq.length;
    setCountTag('pesq-count-tag', base.length, total);
    showFilterBanner('pesq-filter-banner', total, base.length);

    const pageData = paginate(base, pesqPage, ROWS_PER_PAGE);
    const tbody = document.querySelector('#pesq-table tbody');
    tbody.innerHTML = pageData.length
        ? pageData.map(p => `<tr><td>${p.c||''}</td><td>${p.t||''}</td><td>${p.a||''}</td><td>${p.y||''}</td><td>${p.n||''}</td><td>${p.dp||''}</td></tr>`).join('')
        : '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px">Nenhum resultado</td></tr>';
    renderPagination('pesq-pagination', base.length, pesqPage, ROWS_PER_PAGE, pg => { pesqPage = pg; renderPesqFiltered(); });
}

/* ============================================================
   EXTENSAO
   ============================================================ */
let extPage = 1;
let extLocalSearch = '';
let extLocalYear   = '';
let extLocalType   = '';

function initExtensao() {
    const extYears = Object.keys(DATA.extYear).filter(y => y).sort();
    createChart('chart-ext-ano2', {
        type: 'bar',
        data: {
            labels: extYears,
            datasets: [{ label: 'Ações', data: extYears.map(y => DATA.extYear[y]), backgroundColor: '#2e7d32', borderRadius: 6 }]
        },
        options: chartOpts(false)
    });
    createChart('chart-ext-tipos', {
        type: 'doughnut',
        data: {
            labels: DATA.extTypes.map(t => t.t),
            datasets: [{ data: DATA.extTypes.map(t => t.c), backgroundColor: COLORS.slice(0, DATA.extTypes.length) }]
        },
        options: { responsive: true, plugins: { legend: { position: 'right' } } }
    });

    const temas = DATA.extTemas.slice(0, 15);
    createChart('chart-ext-temas', {
        type: 'bar',
        data: {
            labels: temas.map(t => t.a),
            datasets: [{ label: 'Ações', data: temas.map(t => t.c), backgroundColor: COLORS.slice(0, 15), borderRadius: 4 }]
        },
        options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });

    renderWordCloud('wc-extensao', DATA.extWordCloud, 80);

    const yearFilter = document.getElementById('ext-year-filter');
    const typeFilter = document.getElementById('ext-type-filter');
    const extYearsAll = [...new Set(DATA.ext.map(e => e.y))].filter(y => y).sort();
    extYearsAll.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; yearFilter.appendChild(o); });
    const extTypesAll = [...new Set(DATA.ext.map(e => e.tp))].filter(t => t).sort();
    extTypesAll.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; typeFilter.appendChild(o); });

    document.getElementById('ext-search').addEventListener('input',       (e) => { extLocalSearch = e.target.value; extPage = 1; renderExtFiltered(); });
    document.getElementById('ext-year-filter').addEventListener('change', (e) => { extLocalYear   = e.target.value; extPage = 1; renderExtFiltered(); });
    document.getElementById('ext-type-filter').addEventListener('change', (e) => { extLocalType   = e.target.value; extPage = 1; renderExtFiltered(); });
    renderExtFiltered();
}

function renderExtFiltered() {
    let base = filterData(DATA.ext, 'extensao');
    if (extLocalYear)   base = base.filter(e => e.y === extLocalYear);
    if (extLocalType)   base = base.filter(e => e.tp === extLocalType);
    if (extLocalSearch) {
        const kw = extLocalSearch.toLowerCase();
        base = base.filter(e => `${e.t} ${e.co} ${e.at} ${e.dp}`.toLowerCase().includes(kw));
    }

    const total = DATA.ext.length;
    setCountTag('ext-count-tag', base.length, total);
    showFilterBanner('ext-filter-banner', total, base.length);

    const pageData = paginate(base, extPage, ROWS_PER_PAGE);
    const tbody = document.querySelector('#ext-table tbody');
    tbody.innerHTML = pageData.length
        ? pageData.map(e => `<tr><td>${e.t||''}</td><td>${e.tp||''}</td><td>${e.y||''}</td><td>${e.co||''}</td><td>${e.at||''}</td><td>${e.dp||''}</td></tr>`).join('')
        : '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px">Nenhum resultado</td></tr>';
    renderPagination('ext-pagination', base.length, extPage, ROWS_PER_PAGE, pg => { extPage = pg; renderExtFiltered(); });
}

/* ============================================================
   PPG
   ============================================================ */
function initPPG() {
    const campusLabels = Object.keys(DATA.ppgCampus);
    createChart('chart-ppg-campus2', {
        type: 'bar',
        data: {
            labels: campusLabels,
            datasets: [{ label: 'Programas', data: campusLabels.map(c => DATA.ppgCampus[c]), backgroundColor: '#43a047', borderRadius: 6 }]
        },
        options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });

    const ppgList = DATA.ppgAnalysis.slice(0, 20);
    createChart('chart-ppg-docentes', {
        type: 'bar',
        data: {
            labels: ppgList.map(p => p.sg),
            datasets: [{ label: 'Docentes', data: ppgList.map(p => p.nd), backgroundColor: COLORS.slice(0, ppgList.length), borderRadius: 4 }]
        },
        options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => ppgList[items[0].dataIndex].nm } } }, scales: { x: { beginAtZero: true } } }
    });

    const tbody = document.querySelector('#ppg-table tbody');
    tbody.innerHTML = DATA.ppg.map(p =>
        `<tr class="ppg-row-link" data-sg="${p.sg}" title="Ver análise: ${p.nm}">
            <td><strong style="color:var(--blue)">${p.sg}</strong></td>
            <td>${p.nm}</td><td>${p.nv||''}</td><td>${p.cp||''}</td><td>${p.nd||''}</td>
            <td style="color:var(--blue);text-align:center;font-weight:800">&#8594;</td>
        </tr>`
    ).join('');

    tbody.querySelectorAll('.ppg-row-link').forEach(row => {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            const sg = row.dataset.sg;
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            document.querySelector('[data-page="analise-ppg"]').classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('analise-ppg').classList.add('active');
            initPage('analise-ppg');
            setTimeout(() => {
                const sel = document.getElementById('ppg-select');
                sel.value = sg;
                renderPPGAnalysis(sg);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 50);
        });
    });
}

/* ============================================================
   DOCENTES
   ============================================================ */
let docPage = 1;
let docLocalSearch = '';
let docLocalFilter = '';

function initDocentes() {
    const s = DATA.stats;
    const grid = document.getElementById('doc-stats-cards');
    grid.innerHTML = '';
    grid.appendChild(makeStatCard(s.total_docentes, 'Total Docentes'));
    grid.appendChild(makeStatCard(s.com_pesquisa,   'Com Pesquisa'));
    grid.appendChild(makeStatCard(s.com_extensao,   'Com Extensão'));
    grid.appendChild(makeStatCard(s.em_ppg,         'Em PPG'));
    grid.appendChild(makeStatCard(s.tripla,         'Tripla Atuação'));

    document.getElementById('doc-search').addEventListener('input',       (e) => { docLocalSearch = e.target.value; docPage = 1; renderDocentesFiltered(); });
    document.getElementById('doc-filter').addEventListener('change',      (e) => { docLocalFilter = e.target.value; docPage = 1; renderDocentesFiltered(); });
    renderDocentesFiltered();
}

function renderDocentesFiltered() {
    const profiles = DATA.profProfiles;
    let base = filterData(Object.values(profiles), 'docentes');

    if (docLocalFilter === 'pesq')   base = base.filter(p => p.pesq > 0);
    if (docLocalFilter === 'ext')    base = base.filter(p => p.ext > 0);
    if (docLocalFilter === 'ppg')    base = base.filter(p => p.ppg && p.ppg.length > 0);
    if (docLocalFilter === 'tripla') base = base.filter(p => p.pesq > 0 && p.ext > 0 && p.ppg && p.ppg.length > 0);

    if (docLocalSearch) {
        const kw = docLocalSearch.toLowerCase();
        base = base.filter(p => `${p.n} ${p.s} ${p.d}`.toLowerCase().includes(kw));
    }

    base.sort((a, b) => a.n.localeCompare(b.n));
    const total = Object.keys(profiles).length;
    setCountTag('doc-count-tag', base.length, total);
    showFilterBanner('doc-filter-banner', total, base.length);

    const pageData = paginate(base, docPage, ROWS_PER_PAGE);
    const tbody = document.querySelector('#doc-table tbody');
    tbody.innerHTML = pageData.map(p =>
        `<tr><td>${makeClickableName(p.n, p.s)}</td><td>${p.s}</td><td>${p.d||''}</td><td>${p.pesq}</td><td>${p.ext}</td><td>${p.ppg ? p.ppg.join(', ') : ''}</td></tr>`
    ).join('');
    tbody.querySelectorAll('.doc-name-link').forEach(el => {
        el.addEventListener('click', () => openDocenteModal(el.dataset.siape));
    });
    renderPagination('doc-pagination', base.length, docPage, ROWS_PER_PAGE, pg => { docPage = pg; renderDocentesFiltered(); });
}

/* ============================================================
   SANKEY INTERATIVO
   ============================================================ */
function initSankey() {
    const ppgFilter = document.getElementById('sankey-ppg-filter');
    DATA.ppgAnalysis.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.sg;
        const nmT2 = p.nm.charAt(0) + p.nm.slice(1).toLowerCase();
        opt.textContent = `${p.sg} — ${nmT2} (${p.cp})`;
        ppgFilter.appendChild(opt);
    });
    document.getElementById('sankey-update').addEventListener('click', renderSankeyDiagram);
    renderSankeyDiagram();
}

function renderSankeyDiagram() {
    const leftAxis  = document.getElementById('sankey-left').value;
    const rightAxis = document.getElementById('sankey-right').value;
    const ppgFilterEl = document.getElementById('sankey-ppg-filter');
    const selectedPPGs = Array.from(ppgFilterEl.selectedOptions).map(o => o.value);

    let links = [];
    const analyses = selectedPPGs.length > 0
        ? DATA.ppgAnalysis.filter(p => selectedPPGs.includes(p.sg))
        : DATA.ppgAnalysis;

    analyses.forEach(prog => {
        let leftName;
        if (leftAxis === 'programa') leftName = prog.sg;
        else if (leftAxis === 'campus') leftName = prog.cp;
        else if (leftAxis === 'nivel')  leftName = prog.nv;

        if (rightAxis === 'atividade') {
            if (prog.np > 0) links.push({ source: leftName, target: 'Pesquisa',  value: prog.np });
            if (prog.ne > 0) links.push({ source: leftName, target: 'Extensão', value: prog.ne });
        } else if (rightAxis === 'area_pesq') {
            (prog.areas || []).slice(0, 5).forEach(a => {
                if (a.c > 0) links.push({ source: leftName, target: a.a, value: a.c });
            });
        } else if (rightAxis === 'tema_ext') {
            (prog.temas || []).forEach(t => {
                if (t.c > 0) links.push({ source: leftName, target: t.a, value: t.c });
            });
        }
    });

    const linkMap = {};
    links.forEach(l => {
        const key = `${l.source}|||${l.target}`;
        if (!linkMap[key]) linkMap[key] = { source: l.source, target: l.target, value: 0 };
        linkMap[key].value += l.value;
    });
    links = Object.values(linkMap);

    if (!links.length) {
        document.getElementById('sankey-container').innerHTML = '<div class="loading-msg">Nenhum dado para os filtros selecionados.</div>';
        return;
    }

    const nodeNames = [...new Set([...links.map(l => l.source), ...links.map(l => l.target)])];
    const nodeMap   = {};
    nodeNames.forEach((n, i) => nodeMap[n] = i);
    const sankeyData = {
        nodes: nodeNames.map(n => ({ name: n })),
        links: links.map(l => ({ source: nodeMap[l.source], target: nodeMap[l.target], value: l.value }))
    };

    const container = document.getElementById('sankey-container');
    container.innerHTML = '';
    const width  = container.clientWidth - 40;
    const height = Math.max(500, nodeNames.length * 28);

    const svg = d3.select('#sankey-container').append('svg').attr('width', width).attr('height', height);
    const sankey = d3.sankey().nodeWidth(20).nodePadding(12)
        .extent([[10, 10], [width - 10, height - 10]]).nodeSort(null);
    const { nodes, links: sLinks } = sankey(sankeyData);
    const color = d3.scaleOrdinal(d3.schemeTableau10);

    let tooltip = d3.select('.sankey-tooltip');
    if (tooltip.empty()) tooltip = d3.select('body').append('div').attr('class', 'sankey-tooltip').style('display', 'none');

    svg.append('g').selectAll('path').data(sLinks).join('path')
        .attr('d', d3.sankeyLinkHorizontal())
        .attr('fill', 'none')
        .attr('stroke', d => color(d.source.name))
        .attr('stroke-opacity', 0.38)
        .attr('stroke-width', d => Math.max(1, d.width))
        .on('mouseover', function(event, d) {
            d3.select(this).attr('stroke-opacity', 0.7);
            tooltip.style('display', 'block')
                .html(`<strong>${d.source.name}</strong> &rarr; <strong>${d.target.name}</strong><br>Quantidade: ${d.value}`)
                .style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 20) + 'px');
        })
        .on('mousemove', function(event) { tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 20) + 'px'); })
        .on('mouseout',  function() { d3.select(this).attr('stroke-opacity', 0.38); tooltip.style('display', 'none'); });

    const node = svg.append('g').selectAll('g').data(nodes).join('g');
    node.append('rect')
        .attr('x', d => d.x0).attr('y', d => d.y0)
        .attr('height', d => Math.max(1, d.y1 - d.y0)).attr('width', d => d.x1 - d.x0)
        .attr('fill', d => color(d.name)).attr('rx', 3)
        .on('mouseover', function(event, d) {
            tooltip.style('display', 'block').html(`<strong>${d.name}</strong><br>Total: ${d.value}`)
                .style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 20) + 'px');
        })
        .on('mousemove', function(event) { tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 20) + 'px'); })
        .on('mouseout',  function() { tooltip.style('display', 'none'); });
    node.append('text')
        .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr('y', d => (d.y1 + d.y0) / 2).attr('dy', '0.35em')
        .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
        .text(d => d.name).style('font-size', '11px').style('font-weight', '700').style('fill', '#1a2340');
}

/* ============================================================
   ANALISE POR PPG
   ============================================================ */
function initAnalisePPG() {
    const select = document.getElementById('ppg-select');
    select.innerHTML = '<option value="">-- Selecione um programa --</option>';
    DATA.ppgAnalysis.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.sg;
        const nmT = p.nm.charAt(0) + p.nm.slice(1).toLowerCase();
        opt.textContent = `${p.sg} — Programa de Pós-Graduação em ${nmT} (${p.cp})`;
        select.appendChild(opt);
    });
    select.addEventListener('change', () => { if (select.value) renderPPGAnalysis(select.value); });
}

function renderPPGAnalysis(sigla) {
    const prog = DATA.ppgAnalysis.find(p => p.sg === sigla);
    if (!prog) return;

    const grid = document.getElementById('ppg-analysis-stats');
    grid.innerHTML = '';
    grid.appendChild(makeStatCard(prog.nd,   'Docentes'));
    grid.appendChild(makeStatCard(prog.np,   'Projetos de Pesquisa'));
    grid.appendChild(makeStatCard(prog.ne,   'Ações de Extensão'));
    grid.appendChild(makeStatCard(prog.dpesq,'Docentes c/ Pesquisa'));
    grid.appendChild(makeStatCard(prog.dext, 'Docentes c/ Extensão'));
    grid.appendChild(makeStatCard(prog.dboth,'Pesq + Ext'));

    const areas = (prog.areas || []).slice(0, 10);
    createChart('chart-ppg-areas', {
        type: 'bar',
        data: {
            labels: areas.map(a => a.a.length > 25 ? a.a.substring(0,25)+'...' : a.a),
            datasets: [{ label: 'Projetos', data: areas.map(a => a.c), backgroundColor: COLORS.slice(0, areas.length), borderRadius: 4 }]
        },
        options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => areas[items[0].dataIndex].a } } }, scales: { x: { beginAtZero: true } } }
    });

    const temas = (prog.temas || []).slice(0, 10);
    createChart('chart-ppg-temas', {
        type: 'bar',
        data: {
            labels: temas.map(t => t.a),
            datasets: [{ label: 'Ações', data: temas.map(t => t.c), backgroundColor: COLORS.slice(0, temas.length), borderRadius: 4 }]
        },
        options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });

    renderWordCloud('wc-ppg', DATA.ppgWordClouds[sigla], 60);

    const ppgDocs = DATA.ppgDoc.filter(d => d.sg === sigla);
    const tbody = document.querySelector('#ppg-doc-table tbody');
    tbody.innerHTML = ppgDocs.map(d => {
        const prof = DATA.profProfiles[d.s];
        return `<tr><td>${makeClickableName(d.n, d.s)}</td><td>${d.s}</td><td>${prof ? prof.pesq : 0}</td><td>${prof ? prof.ext : 0}</td></tr>`;
    }).join('');
    tbody.querySelectorAll('.doc-name-link').forEach(el => {
        el.addEventListener('click', () => openDocenteModal(el.dataset.siape));
    });
}

/* ============================================================
   ANALISE POR DOCENTE
   ============================================================ */
function initAnaliseDocentes() {
    const input  = document.getElementById('docente-search-input');
    const sugDiv = document.getElementById('docente-suggestions');
    const allProfs = Object.values(DATA.profProfiles).sort((a, b) => a.n.localeCompare(b.n));

    input.addEventListener('input', () => {
        const q = input.value.toLowerCase().trim();
        if (q.length < 2) { sugDiv.classList.remove('show'); return; }
        const matches = allProfs.filter(p => p.n.toLowerCase().includes(q)).slice(0, 15);
        if (!matches.length) { sugDiv.classList.remove('show'); return; }
        sugDiv.innerHTML = matches.map(p =>
            `<div class="suggestion-item" data-siape="${p.s}"><strong>${p.n}</strong><div class="sub">${p.d||''} | SIAPE: ${p.s}</div></div>`
        ).join('');
        sugDiv.classList.add('show');
        sugDiv.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                sugDiv.classList.remove('show');
                input.value = DATA.profProfiles[item.dataset.siape].n;
                renderDocenteAnalysis(item.dataset.siape);
            });
        });
    });
    input.addEventListener('blur', () => { setTimeout(() => sugDiv.classList.remove('show'), 200); });
}

function renderDocenteAnalysis(siape) {
    const prof = DATA.profProfiles[siape];
    if (!prof) return;
    document.getElementById('docente-analysis-content').style.display = 'block';

    const grid = document.getElementById('docente-stats');
    grid.innerHTML = '';
    grid.appendChild(makeStatCard(prof.pesq, 'Projetos de Pesquisa'));
    grid.appendChild(makeStatCard(prof.ext,  'Ações de Extensão'));
    grid.appendChild(makeStatCard(prof.ppg ? prof.ppg.length : 0, 'Programas PPG'));

    const areas = (prof.pesqAreas || []).slice(0, 10);
    if (areas.length) {
        createChart('chart-docente-areas', {
            type: 'bar',
            data: { labels: areas.map(a => a.a), datasets: [{ label: 'Projetos', data: areas.map(a => a.c), backgroundColor: COLORS.slice(0, areas.length), borderRadius: 4 }] },
            options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
        });
    } else {
        destroyChart('chart-docente-areas');
    }

    const temas = (prof.extTemas || []).slice(0, 10);
    if (temas.length) {
        createChart('chart-docente-temas', {
            type: 'bar',
            data: { labels: temas.map(t => t.a), datasets: [{ label: 'Ações', data: temas.map(t => t.c), backgroundColor: COLORS.slice(0, temas.length), borderRadius: 4 }] },
            options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
        });
    } else {
        destroyChart('chart-docente-temas');
    }

    const pesqProjs = DATA.pesq.filter(p => p.s === siape);
    const pesqTbody = document.querySelector('#docente-pesq-table tbody');
    pesqTbody.innerHTML = pesqProjs.length
        ? pesqProjs.map(p => `<tr><td>${p.c||''}</td><td>${p.t||''}</td><td>${p.a||''}</td><td>${p.y||''}</td></tr>`).join('')
        : '<tr><td colspan="4" style="color:#aaa;text-align:center;padding:20px">Nenhum projeto de pesquisa</td></tr>';

    const extAcoes = DATA.ext.filter(e => e.s === siape);
    const extTbody = document.querySelector('#docente-ext-table tbody');
    extTbody.innerHTML = extAcoes.length
        ? extAcoes.map(e => `<tr><td>${e.t||''}</td><td>${e.tp||''}</td><td>${e.y||''}</td><td>${e.at||''}</td></tr>`).join('')
        : '<tr><td colspan="4" style="color:#aaa;text-align:center;padding:20px">Nenhuma ação de extensão</td></tr>';

    const ppgDiv = document.getElementById('docente-ppg-info');
    if (prof.ppg && prof.ppg.length) {
        ppgDiv.innerHTML = prof.ppg.map(sg => {
            const prog = DATA.ppg.find(p => p.sg === sg);
            return `<span class="ppg-badge">${sg} - ${prog ? prog.nm : ''}</span>`;
        }).join('');
    } else {
        ppgDiv.innerHTML = '<p style="color:#aaa;padding:10px">Não vinculado a programas de pós-graduação</p>';
    }
}

// Mark visao-geral as initialized
initializedPages['visao-geral'] = true;


/* ============================================================
   MODAL DOCENTE - painel lateral com projetos do docente
   ============================================================ */

function openDocenteModal(siape) {
    const prof = DATA.profProfiles[siape];
    if (!prof) return;

    const overlay = document.getElementById('docente-modal-overlay');

    // Name & dept
    document.getElementById('dm-name').textContent = toTitleCase(prof.n);
    const deptShort = (prof.d || '').replace(/FACULDADE DE /i, 'Fac. ').replace(/CIÊNCIAS /i, 'Ciências ');
    document.getElementById('dm-dept').textContent = deptShort || 'Departamento não informado';

    // PPG badges
    const ppgRow = document.getElementById('dm-ppg-row');
    ppgRow.innerHTML = '';
    if (prof.ppg && prof.ppg.length) {
        prof.ppg.forEach(sg => {
            const prog = DATA.ppg.find(p => p.sg === sg);
            const sp = document.createElement('span');
            sp.className = 'dm-ppg-badge';
            sp.textContent = sg + (prog ? ' · ' + toTitleCase(prog.nm) : '');
            ppgRow.appendChild(sp);
        });
    }

    // Stats
    const pesqProjs = DATA.pesq.filter(p => p.s === siape);
    const extAcoes  = DATA.ext.filter(e => e.s === siape);
    const statsDiv  = document.getElementById('dm-stats');
    statsDiv.innerHTML = `
        <div class="dm-stat"><div class="dsv">${pesqProjs.length}</div><div class="dsl">Projetos de Pesquisa</div></div>
        <div class="dm-stat"><div class="dsv">${extAcoes.length}</div><div class="dsl">Ações de Extensão</div></div>
        <div class="dm-stat"><div class="dsv">${prof.ppg ? prof.ppg.length : 0}</div><div class="dsl">Programas PPG</div></div>
    `;

    // Body - cards
    const body = document.getElementById('dm-body');
    body.innerHTML = '';

    // --- Pesquisa cards ---
    if (pesqProjs.length) {
        const secP = document.createElement('div');
        secP.className = 'dm-section-title';
        secP.innerHTML = '&#128270; Projetos de Pesquisa';
        body.appendChild(secP);

        pesqProjs.forEach(p => {
            const card = document.createElement('div');
            card.className = 'dm-card';
            card.innerHTML = `
                <div class="dm-card-type pesq">&#128270; Pesquisa</div>
                <div class="dm-card-title">${p.t || 'Título não informado'}</div>
                <div class="dm-card-meta">
                    ${p.c  ? `<span class="dm-meta-tag">&#128196; ${p.c}</span>` : ''}
                    ${p.a  ? `<span class="dm-meta-tag">&#127991; ${p.a}</span>` : ''}
                    ${p.y  ? `<span class="dm-meta-tag">&#128197; ${p.y}</span>` : ''}
                    ${p.dp ? `<span class="dm-meta-tag">&#127979; ${p.dp.replace('FACULDADE DE ','').replace('FACULDADE ','')}</span>` : ''}
                </div>`;
            body.appendChild(card);
        });
    }

    // --- Extensão cards ---
    if (extAcoes.length) {
        const secE = document.createElement('div');
        secE.className = 'dm-section-title';
        secE.innerHTML = '&#127758; Ações de Extensão';
        body.appendChild(secE);

        extAcoes.forEach(e => {
            const card = document.createElement('div');
            card.className = 'dm-card ext';
            card.innerHTML = `
                <div class="dm-card-type ext">&#127758; ${e.tp || 'Extensão'}</div>
                <div class="dm-card-title">${e.t || 'Título não informado'}</div>
                <div class="dm-card-meta">
                    ${e.at ? `<span class="dm-meta-tag">&#127991; ${e.at}</span>` : ''}
                    ${e.y  ? `<span class="dm-meta-tag">&#128197; ${e.y}</span>` : ''}
                    ${e.dp ? `<span class="dm-meta-tag">&#127979; ${e.dp.replace('FACULDADE DE ','').replace('FACULDADE ','')}</span>` : ''}
                </div>`;
            body.appendChild(card);
        });
    }

    if (!pesqProjs.length && !extAcoes.length) {
        body.innerHTML = '<div class="dm-empty">Nenhum projeto ou ação registrada para este docente.</div>';
    }

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeDocenteModal() {
    document.getElementById('docente-modal-overlay').style.display = 'none';
    document.body.style.overflow = '';
}

// Modal close events setup - called from main init
function setupModalEvents() {
    document.getElementById('dm-close').addEventListener('click', closeDocenteModal);
    document.getElementById('docente-modal-overlay').addEventListener('click', function(e) {
        if (e.target === this) closeDocenteModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDocenteModal(); });
}

/* Helper: wrap a docente name cell to be clickable */
function makeClickableName(name, siape) {
    if (!siape) return name;
    return `<span class="doc-name-link" data-siape="${siape}" title="Ver projetos de ${toTitleCase(name)}">${toTitleCase(name)}</span>`;
}
