/* ============================================
   PAINEL UNEMAT v3 - app.js
   ============================================ */

let DATA = null;
const chartInstances = {};
const COLORS = [
    '#1a237e','#0277bd','#00838f','#2e7d32','#558b2f','#f9a825',
    '#ef6c00','#d84315','#6a1b9a','#ad1457','#4527a0','#00695c',
    '#1565c0','#c62828','#4e342e','#37474f','#7b1fa2','#e65100',
    '#33691e','#01579b','#880e4f','#311b92','#004d40','#bf360c'
];
const ROWS_PER_PAGE = 50;

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const resp = await fetch('data.json');
        DATA = await resp.json();
        console.log('Data loaded:', Object.keys(DATA));
        setupNavigation();
        initVisaoGeral();
    } catch(e) {
        console.error('Failed to load data:', e);
        document.getElementById('content').innerHTML = '<div class="loading-msg">Erro ao carregar dados. Verifique se data.json esta no mesmo diretorio.</div>';
    }
});

// ========== NAVIGATION ==========
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(page).classList.add('active');
            // Initialize page on first visit
            initPage(page);
        });
    });
}

const initializedPages = {};
function initPage(page) {
    if (initializedPages[page]) return;
    initializedPages[page] = true;
    switch(page) {
        case 'visao-geral': initVisaoGeral(); break;
        case 'pesquisa': initPesquisa(); break;
        case 'extensao': initExtensao(); break;
        case 'ppg': initPPG(); break;
        case 'docentes': initDocentes(); break;
        case 'sankey': initSankey(); break;
        case 'analise-ppg': initAnalisePPG(); break;
        case 'analise-docentes': initAnaliseDocentes(); break;
    }
}

// ========== UTILITY ==========
function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

function createChart(canvasId, config) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) { console.error('Canvas not found:', canvasId); return null; }
    chartInstances[canvasId] = new Chart(ctx.getContext('2d'), config);
    return chartInstances[canvasId];
}

function makeStatCard(value, label) {
    const d = document.createElement('div');
    d.className = 'stat-card';
    d.innerHTML = `<div class="stat-value">${value.toLocaleString('pt-BR')}</div><div class="stat-label">${label}</div>`;
    return d;
}

function renderWordCloud(containerId, words, maxWords) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const subset = (words || []).slice(0, maxWords || 80);
    if (subset.length === 0) { container.innerHTML = '<p style="color:#888">Sem dados</p>'; return; }
    const maxC = Math.max(...subset.map(w => w.c));
    const minC = Math.min(...subset.map(w => w.c));
    const colors = ['#1a237e','#0277bd','#2e7d32','#ef6c00','#ad1457','#6a1b9a','#00838f','#d84315','#558b2f','#c62828'];
    subset.forEach((item, i) => {
        const ratio = maxC === minC ? 0.5 : (item.c - minC) / (maxC - minC);
        const size = 12 + ratio * 36;
        const span = document.createElement('span');
        span.className = 'wc-word';
        span.textContent = item.w;
        span.title = `${item.w}: ${item.c}`;
        span.style.fontSize = size + 'px';
        span.style.color = colors[i % colors.length];
        span.style.opacity = 0.6 + ratio * 0.4;
        container.appendChild(span);
    });
}

function paginate(data, page, perPage) {
    const start = (page - 1) * perPage;
    return data.slice(start, start + perPage);
}

function renderPagination(containerId, totalItems, currentPage, perPage, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const totalPages = Math.ceil(totalItems / perPage);
    if (totalPages <= 1) return;

    const maxButtons = 10;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) startPage = Math.max(1, endPage - maxButtons + 1);

    if (currentPage > 1) {
        const prev = document.createElement('button');
        prev.textContent = 'Anterior';
        prev.onclick = () => callback(currentPage - 1);
        container.appendChild(prev);
    }
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) btn.className = 'active';
        btn.onclick = () => callback(i);
        container.appendChild(btn);
    }
    if (currentPage < totalPages) {
        const next = document.createElement('button');
        next.textContent = 'Proximo';
        next.onclick = () => callback(currentPage + 1);
        container.appendChild(next);
    }
}

// ========== VISAO GERAL ==========
function initVisaoGeral() {
    const s = DATA.stats;
    const grid = document.getElementById('stats-cards');
    grid.innerHTML = '';
    grid.appendChild(makeStatCard(s.total_docentes, 'Docentes'));
    grid.appendChild(makeStatCard(s.reg_pesq, 'Registros de Pesquisa'));
    grid.appendChild(makeStatCard(s.acoes_ext, 'Acoes de Extensao'));
    grid.appendChild(makeStatCard(s.progs_ppg, 'Programas PPG'));
    grid.appendChild(makeStatCard(s.com_pesquisa, 'Docentes c/ Pesquisa'));
    grid.appendChild(makeStatCard(s.com_extensao, 'Docentes c/ Extensao'));
    grid.appendChild(makeStatCard(s.em_ppg, 'Docentes em PPG'));
    grid.appendChild(makeStatCard(s.tripla, 'Pesq+Ext+PPG'));

    // Pesquisa por ano
    const pesqYears = Object.keys(DATA.pesqYear).sort();
    createChart('chart-pesq-ano', {
        type: 'bar',
        data: {
            labels: pesqYears,
            datasets: [{
                label: 'Registros de Pesquisa',
                data: pesqYears.map(y => DATA.pesqYear[y]),
                backgroundColor: '#1a237e',
                borderRadius: 6
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    // Extensao por ano
    const extYears = Object.keys(DATA.extYear).filter(y => y).sort();
    createChart('chart-ext-ano', {
        type: 'bar',
        data: {
            labels: extYears,
            datasets: [{
                label: 'Acoes de Extensao',
                data: extYears.map(y => DATA.extYear[y]),
                backgroundColor: '#0277bd',
                borderRadius: 6
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    // Perfil docentes
    createChart('chart-doc-perfil', {
        type: 'doughnut',
        data: {
            labels: ['So Pesquisa', 'So Extensao', 'Pesq+Ext', 'Pesq+PPG', 'Ext+PPG', 'Pesq+Ext+PPG', 'Sem atividade registrada'],
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

    // PPG por campus
    const campusLabels = Object.keys(DATA.ppgCampus);
    createChart('chart-ppg-campus', {
        type: 'bar',
        data: {
            labels: campusLabels,
            datasets: [{
                label: 'Programas',
                data: campusLabels.map(c => DATA.ppgCampus[c]),
                backgroundColor: '#2e7d32',
                borderRadius: 6
            }]
        },
        options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });
}

// ========== PESQUISA ==========
function initPesquisa() {
    // Registros por ano
    const pesqYears = Object.keys(DATA.pesqYear).sort();
    createChart('chart-pesq-ano2', {
        type: 'bar',
        data: {
            labels: pesqYears,
            datasets: [{
                label: 'Registros',
                data: pesqYears.map(y => DATA.pesqYear[y]),
                backgroundColor: '#1a237e',
                borderRadius: 6
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    // Top 20 areas
    const areas = DATA.topAreas.slice(0, 20);
    createChart('chart-top-areas', {
        type: 'bar',
        data: {
            labels: areas.map(a => a.a.length > 30 ? a.a.substring(0,30)+'...' : a.a),
            datasets: [{
                label: 'Projetos',
                data: areas.map(a => a.c),
                backgroundColor: COLORS.slice(0, 20),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => areas[items[0].dataIndex].a } } },
            scales: { x: { beginAtZero: true } }
        }
    });

    // Word cloud
    renderWordCloud('wc-pesquisa', DATA.wordCloud, 80);

    // Table
    const yearFilter = document.getElementById('pesq-year-filter');
    pesqYears.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; yearFilter.appendChild(o); });

    let pesqPage = 1;
    function renderPesqTable() {
        const search = document.getElementById('pesq-search').value.toLowerCase();
        const yearVal = document.getElementById('pesq-year-filter').value;
        let filtered = DATA.pesq.filter(p => {
            if (yearVal && p.y !== yearVal) return false;
            if (search) {
                const str = `${p.c} ${p.t} ${p.a} ${p.n} ${p.dp}`.toLowerCase();
                if (!str.includes(search)) return false;
            }
            return true;
        });
        const pageData = paginate(filtered, pesqPage, ROWS_PER_PAGE);
        const tbody = document.querySelector('#pesq-table tbody');
        tbody.innerHTML = pageData.map(p =>
            `<tr><td>${p.c||''}</td><td>${p.t||''}</td><td>${p.a||''}</td><td>${p.y||''}</td><td>${p.n||''}</td><td>${p.dp||''}</td></tr>`
        ).join('');
        renderPagination('pesq-pagination', filtered.length, pesqPage, ROWS_PER_PAGE, (pg) => { pesqPage = pg; renderPesqTable(); });
    }
    document.getElementById('pesq-search').addEventListener('input', () => { pesqPage = 1; renderPesqTable(); });
    document.getElementById('pesq-year-filter').addEventListener('change', () => { pesqPage = 1; renderPesqTable(); });
    renderPesqTable();
}

// ========== EXTENSAO ==========
function initExtensao() {
    // Por ano
    const extYears = Object.keys(DATA.extYear).filter(y => y).sort();
    createChart('chart-ext-ano2', {
        type: 'bar',
        data: {
            labels: extYears,
            datasets: [{
                label: 'Acoes',
                data: extYears.map(y => DATA.extYear[y]),
                backgroundColor: '#0277bd',
                borderRadius: 6
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    // Tipos
    createChart('chart-ext-tipos', {
        type: 'doughnut',
        data: {
            labels: DATA.extTypes.map(t => t.t),
            datasets: [{
                data: DATA.extTypes.map(t => t.c),
                backgroundColor: COLORS.slice(0, DATA.extTypes.length)
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'right' } } }
    });

    // Temas
    const temas = DATA.extTemas.slice(0, 15);
    createChart('chart-ext-temas', {
        type: 'bar',
        data: {
            labels: temas.map(t => t.a),
            datasets: [{
                label: 'Acoes',
                data: temas.map(t => t.c),
                backgroundColor: COLORS.slice(0, 15),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } }
        }
    });

    // Word cloud extensao
    renderWordCloud('wc-extensao', DATA.extWordCloud, 80);

    // Table
    const yearFilter = document.getElementById('ext-year-filter');
    const typeFilter = document.getElementById('ext-type-filter');
    const extYearsAll = [...new Set(DATA.ext.map(e => e.y))].filter(y => y).sort();
    extYearsAll.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; yearFilter.appendChild(o); });
    const extTypesAll = [...new Set(DATA.ext.map(e => e.tp))].filter(t => t).sort();
    extTypesAll.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; typeFilter.appendChild(o); });

    let extPage = 1;
    function renderExtTable() {
        const search = document.getElementById('ext-search').value.toLowerCase();
        const yearVal = document.getElementById('ext-year-filter').value;
        const typeVal = document.getElementById('ext-type-filter').value;
        let filtered = DATA.ext.filter(e => {
            if (yearVal && e.y !== yearVal) return false;
            if (typeVal && e.tp !== typeVal) return false;
            if (search) {
                const str = `${e.t} ${e.co} ${e.at} ${e.dp}`.toLowerCase();
                if (!str.includes(search)) return false;
            }
            return true;
        });
        const pageData = paginate(filtered, extPage, ROWS_PER_PAGE);
        const tbody = document.querySelector('#ext-table tbody');
        tbody.innerHTML = pageData.map(e =>
            `<tr><td>${e.t||''}</td><td>${e.tp||''}</td><td>${e.y||''}</td><td>${e.co||''}</td><td>${e.at||''}</td><td>${e.dp||''}</td></tr>`
        ).join('');
        renderPagination('ext-pagination', filtered.length, extPage, ROWS_PER_PAGE, (pg) => { extPage = pg; renderExtTable(); });
    }
    document.getElementById('ext-search').addEventListener('input', () => { extPage = 1; renderExtTable(); });
    document.getElementById('ext-year-filter').addEventListener('change', () => { extPage = 1; renderExtTable(); });
    document.getElementById('ext-type-filter').addEventListener('change', () => { extPage = 1; renderExtTable(); });
    renderExtTable();
}

// ========== PPG ==========
function initPPG() {
    // Campus chart
    const campusLabels = Object.keys(DATA.ppgCampus);
    createChart('chart-ppg-campus2', {
        type: 'bar',
        data: {
            labels: campusLabels,
            datasets: [{
                label: 'Programas',
                data: campusLabels.map(c => DATA.ppgCampus[c]),
                backgroundColor: '#2e7d32',
                borderRadius: 6
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    // Docentes por programa
    const ppgSorted = [...DATA.ppg].sort((a, b) => b.nd - a.nd);
    createChart('chart-ppg-docentes', {
        type: 'bar',
        data: {
            labels: ppgSorted.map(p => p.sg),
            datasets: [{
                label: 'Docentes',
                data: ppgSorted.map(p => p.nd),
                backgroundColor: COLORS.slice(0, ppgSorted.length),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => ppgSorted[items[0].dataIndex].nm } } },
            scales: { x: { beginAtZero: true } }
        }
    });

    // Table
    const tbody = document.querySelector('#ppg-table tbody');
    tbody.innerHTML = DATA.ppg.map(p =>
        `<tr><td>${p.sg}</td><td>${p.nm}</td><td>${p.nv}</td><td>${p.cp}</td><td>${p.nd}</td></tr>`
    ).join('');
}

// ========== DOCENTES ==========
function initDocentes() {
    const s = DATA.stats;
    const grid = document.getElementById('doc-stats-cards');
    grid.innerHTML = '';
    grid.appendChild(makeStatCard(s.total_docentes, 'Total Docentes'));
    grid.appendChild(makeStatCard(s.com_pesquisa, 'Com Pesquisa'));
    grid.appendChild(makeStatCard(s.com_extensao, 'Com Extensao'));
    grid.appendChild(makeStatCard(s.em_ppg, 'Em PPG'));
    grid.appendChild(makeStatCard(s.tripla, 'Tripla Atuacao'));

    // Build profile lookup
    const profiles = DATA.profProfiles;

    let docPage = 1;
    function renderDocTable() {
        const search = document.getElementById('doc-search').value.toLowerCase();
        const filter = document.getElementById('doc-filter').value;

        let filtered = Object.values(profiles).filter(p => {
            if (filter === 'pesq' && p.pesq === 0) return false;
            if (filter === 'ext' && p.ext === 0) return false;
            if (filter === 'ppg' && (!p.ppg || p.ppg.length === 0)) return false;
            if (filter === 'tripla' && (p.pesq === 0 || p.ext === 0 || !p.ppg || p.ppg.length === 0)) return false;
            if (search) {
                const str = `${p.n} ${p.s} ${p.d}`.toLowerCase();
                if (!str.includes(search)) return false;
            }
            return true;
        });
        filtered.sort((a, b) => a.n.localeCompare(b.n));

        const pageData = paginate(filtered, docPage, ROWS_PER_PAGE);
        const tbody = document.querySelector('#doc-table tbody');
        tbody.innerHTML = pageData.map(p =>
            `<tr><td>${p.n}</td><td>${p.s}</td><td>${p.d||''}</td><td>${p.pesq}</td><td>${p.ext}</td><td>${p.ppg ? p.ppg.join(', ') : ''}</td></tr>`
        ).join('');
        renderPagination('doc-pagination', filtered.length, docPage, ROWS_PER_PAGE, (pg) => { docPage = pg; renderDocTable(); });
    }
    document.getElementById('doc-search').addEventListener('input', () => { docPage = 1; renderDocTable(); });
    document.getElementById('doc-filter').addEventListener('change', () => { docPage = 1; renderDocTable(); });
    renderDocTable();
}

// ========== SANKEY INTERATIVO ==========
function initSankey() {
    // Populate PPG filter
    const ppgFilter = document.getElementById('sankey-ppg-filter');
    DATA.ppgAnalysis.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.sg;
        opt.textContent = `${p.sg} - ${p.nm}`;
        ppgFilter.appendChild(opt);
    });

    document.getElementById('sankey-update').addEventListener('click', renderSankeyDiagram);
    renderSankeyDiagram();
}

function renderSankeyDiagram() {
    const leftAxis = document.getElementById('sankey-left').value;
    const rightAxis = document.getElementById('sankey-right').value;
    const ppgFilterEl = document.getElementById('sankey-ppg-filter');
    const selectedPPGs = Array.from(ppgFilterEl.selectedOptions).map(o => o.value);

    // Build links from ppgAnalysis data
    let links = [];
    const analyses = selectedPPGs.length > 0
        ? DATA.ppgAnalysis.filter(p => selectedPPGs.includes(p.sg))
        : DATA.ppgAnalysis;

    analyses.forEach(prog => {
        let leftName;
        if (leftAxis === 'programa') leftName = prog.sg;
        else if (leftAxis === 'campus') leftName = prog.cp;
        else if (leftAxis === 'nivel') leftName = prog.nv;

        if (rightAxis === 'atividade') {
            if (prog.np > 0) links.push({ source: leftName, target: 'Pesquisa', value: prog.np });
            if (prog.ne > 0) links.push({ source: leftName, target: 'Extensao', value: prog.ne });
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

    // Aggregate links with same source+target
    const linkMap = {};
    links.forEach(l => {
        const key = `${l.source}|||${l.target}`;
        if (!linkMap[key]) linkMap[key] = { source: l.source, target: l.target, value: 0 };
        linkMap[key].value += l.value;
    });
    links = Object.values(linkMap);

    if (links.length === 0) {
        document.getElementById('sankey-container').innerHTML = '<div class="loading-msg">Nenhum dado para os filtros selecionados.</div>';
        return;
    }

    // Build nodes
    const nodeNames = [...new Set([...links.map(l => l.source), ...links.map(l => l.target)])];
    const nodeMap = {};
    nodeNames.forEach((n, i) => nodeMap[n] = i);

    const sankeyData = {
        nodes: nodeNames.map(n => ({ name: n })),
        links: links.map(l => ({ source: nodeMap[l.source], target: nodeMap[l.target], value: l.value }))
    };

    // Render with D3
    const container = document.getElementById('sankey-container');
    container.innerHTML = '';
    const width = container.clientWidth - 40;
    const height = Math.max(500, nodeNames.length * 28);

    const svg = d3.select('#sankey-container')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const sankey = d3.sankey()
        .nodeWidth(20)
        .nodePadding(12)
        .extent([[10, 10], [width - 10, height - 10]])
        .nodeSort(null);

    const { nodes, links: sLinks } = sankey(sankeyData);

    // Color scale
    const color = d3.scaleOrdinal(d3.schemeTableau10);

    // Tooltip
    let tooltip = d3.select('.sankey-tooltip');
    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div').attr('class', 'sankey-tooltip').style('display', 'none');
    }

    // Links
    svg.append('g')
        .selectAll('path')
        .data(sLinks)
        .join('path')
        .attr('d', d3.sankeyLinkHorizontal())
        .attr('fill', 'none')
        .attr('stroke', d => color(d.source.name))
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', d => Math.max(1, d.width))
        .on('mouseover', function(event, d) {
            d3.select(this).attr('stroke-opacity', 0.7);
            tooltip.style('display', 'block')
                .html(`<strong>${d.source.name}</strong> → <strong>${d.target.name}</strong><br>Quantidade: ${d.value}`)
                .style('left', (event.pageX + 12) + 'px')
                .style('top', (event.pageY - 20) + 'px');
        })
        .on('mousemove', function(event) {
            tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 20) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this).attr('stroke-opacity', 0.4);
            tooltip.style('display', 'none');
        });

    // Nodes
    const node = svg.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g');

    node.append('rect')
        .attr('x', d => d.x0)
        .attr('y', d => d.y0)
        .attr('height', d => Math.max(1, d.y1 - d.y0))
        .attr('width', d => d.x1 - d.x0)
        .attr('fill', d => color(d.name))
        .attr('rx', 3)
        .on('mouseover', function(event, d) {
            tooltip.style('display', 'block')
                .html(`<strong>${d.name}</strong><br>Total: ${d.value}`)
                .style('left', (event.pageX + 12) + 'px')
                .style('top', (event.pageY - 20) + 'px');
        })
        .on('mousemove', function(event) {
            tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 20) + 'px');
        })
        .on('mouseout', function() { tooltip.style('display', 'none'); });

    // Labels
    node.append('text')
        .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr('y', d => (d.y1 + d.y0) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
        .text(d => d.name)
        .style('font-size', '11px')
        .style('font-weight', '600')
        .style('fill', '#333');
}

// ========== ANALISE POR PPG ==========
function initAnalisePPG() {
    const select = document.getElementById('ppg-select');
    select.innerHTML = '<option value="">-- Selecione um programa --</option>';
    DATA.ppgAnalysis.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.sg;
        opt.textContent = `${p.sg} - ${p.nm} (${p.cp})`;
        select.appendChild(opt);
    });
    select.addEventListener('change', () => {
        const sg = select.value;
        if (!sg) return;
        renderPPGAnalysis(sg);
    });
}

function renderPPGAnalysis(sigla) {
    const prog = DATA.ppgAnalysis.find(p => p.sg === sigla);
    if (!prog) return;

    // Stats
    const grid = document.getElementById('ppg-analysis-stats');
    grid.innerHTML = '';
    grid.appendChild(makeStatCard(prog.nd, 'Docentes'));
    grid.appendChild(makeStatCard(prog.np, 'Projetos Pesquisa'));
    grid.appendChild(makeStatCard(prog.ne, 'Acoes Extensao'));
    grid.appendChild(makeStatCard(prog.dpesq, 'Docentes c/ Pesquisa'));
    grid.appendChild(makeStatCard(prog.dext, 'Docentes c/ Extensao'));
    grid.appendChild(makeStatCard(prog.dboth, 'Pesq + Ext'));

    // Areas chart
    const areas = (prog.areas || []).slice(0, 10);
    createChart('chart-ppg-areas', {
        type: 'bar',
        data: {
            labels: areas.map(a => a.a.length > 25 ? a.a.substring(0,25)+'...' : a.a),
            datasets: [{
                label: 'Projetos',
                data: areas.map(a => a.c),
                backgroundColor: COLORS.slice(0, areas.length),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => areas[items[0].dataIndex].a } } },
            scales: { x: { beginAtZero: true } }
        }
    });

    // Temas chart
    const temas = (prog.temas || []).slice(0, 10);
    createChart('chart-ppg-temas', {
        type: 'bar',
        data: {
            labels: temas.map(t => t.a),
            datasets: [{
                label: 'Acoes',
                data: temas.map(t => t.c),
                backgroundColor: COLORS.slice(0, temas.length),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } }
        }
    });

    // Word cloud
    const wcData = DATA.ppgWordClouds[sigla];
    renderWordCloud('wc-ppg', wcData, 60);

    // Docentes table
    const ppgDocs = DATA.ppgDoc.filter(d => d.sg === sigla);
    const tbody = document.querySelector('#ppg-doc-table tbody');
    tbody.innerHTML = ppgDocs.map(d => {
        const prof = DATA.profProfiles[d.s];
        const pesqCount = prof ? prof.pesq : 0;
        const extCount = prof ? prof.ext : 0;
        return `<tr><td>${d.n}</td><td>${d.s}</td><td>${pesqCount}</td><td>${extCount}</td></tr>`;
    }).join('');
}

// ========== ANALISE POR DOCENTE ==========
function initAnaliseDocentes() {
    const input = document.getElementById('docente-search-input');
    const sugDiv = document.getElementById('docente-suggestions');
    const profiles = DATA.profProfiles;
    const allProfs = Object.values(profiles).sort((a, b) => a.n.localeCompare(b.n));

    input.addEventListener('input', () => {
        const q = input.value.toLowerCase().trim();
        if (q.length < 2) { sugDiv.classList.remove('show'); return; }
        const matches = allProfs.filter(p => p.n.toLowerCase().includes(q)).slice(0, 15);
        if (matches.length === 0) { sugDiv.classList.remove('show'); return; }
        sugDiv.innerHTML = matches.map(p =>
            `<div class="suggestion-item" data-siape="${p.s}"><strong>${p.n}</strong><div class="sub">${p.d || ''} | SIAPE: ${p.s}</div></div>`
        ).join('');
        sugDiv.classList.add('show');
        sugDiv.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const siape = item.dataset.siape;
                sugDiv.classList.remove('show');
                input.value = profiles[siape].n;
                renderDocenteAnalysis(siape);
            });
        });
    });

    input.addEventListener('blur', () => { setTimeout(() => sugDiv.classList.remove('show'), 200); });
}

function renderDocenteAnalysis(siape) {
    const prof = DATA.profProfiles[siape];
    if (!prof) return;
    document.getElementById('docente-analysis-content').style.display = 'block';

    // Stats
    const grid = document.getElementById('docente-stats');
    grid.innerHTML = '';
    grid.appendChild(makeStatCard(prof.pesq, 'Projetos Pesquisa'));
    grid.appendChild(makeStatCard(prof.ext, 'Acoes Extensao'));
    grid.appendChild(makeStatCard(prof.ppg ? prof.ppg.length : 0, 'Programas PPG'));

    // Areas chart
    const areas = (prof.pesqAreas || []).slice(0, 10);
    if (areas.length > 0) {
        createChart('chart-docente-areas', {
            type: 'bar',
            data: {
                labels: areas.map(a => a.a),
                datasets: [{
                    label: 'Projetos',
                    data: areas.map(a => a.c),
                    backgroundColor: COLORS.slice(0, areas.length),
                    borderRadius: 4
                }]
            },
            options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
        });
    } else {
        destroyChart('chart-docente-areas');
        document.getElementById('chart-docente-areas').parentElement.querySelector('h3').insertAdjacentHTML('afterend', '<p style="color:#888;padding:20px">Sem projetos de pesquisa registrados</p>');
    }

    // Temas chart
    const temas = (prof.extTemas || []).slice(0, 10);
    if (temas.length > 0) {
        createChart('chart-docente-temas', {
            type: 'bar',
            data: {
                labels: temas.map(t => t.a),
                datasets: [{
                    label: 'Acoes',
                    data: temas.map(t => t.c),
                    backgroundColor: COLORS.slice(0, temas.length),
                    borderRadius: 4
                }]
            },
            options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
        });
    } else {
        destroyChart('chart-docente-temas');
    }

    // Pesquisa table
    const pesqProjs = DATA.pesq.filter(p => p.s === siape);
    const pesqTbody = document.querySelector('#docente-pesq-table tbody');
    pesqTbody.innerHTML = pesqProjs.length > 0
        ? pesqProjs.map(p => `<tr><td>${p.c||''}</td><td>${p.t||''}</td><td>${p.a||''}</td><td>${p.y||''}</td></tr>`).join('')
        : '<tr><td colspan="4" style="color:#888;text-align:center">Nenhum projeto de pesquisa</td></tr>';

    // Extensao table
    const extAcoes = DATA.ext.filter(e => e.s === siape);
    const extTbody = document.querySelector('#docente-ext-table tbody');
    extTbody.innerHTML = extAcoes.length > 0
        ? extAcoes.map(e => `<tr><td>${e.t||''}</td><td>${e.tp||''}</td><td>${e.y||''}</td><td>${e.at||''}</td></tr>`).join('')
        : '<tr><td colspan="4" style="color:#888;text-align:center">Nenhuma acao de extensao</td></tr>';

    // PPG info
    const ppgDiv = document.getElementById('docente-ppg-info');
    if (prof.ppg && prof.ppg.length > 0) {
        ppgDiv.innerHTML = prof.ppg.map(sg => {
            const prog = DATA.ppg.find(p => p.sg === sg);
            return `<span class="ppg-badge">${sg} - ${prog ? prog.nm : ''}</span>`;
        }).join('');
    } else {
        ppgDiv.innerHTML = '<p style="color:#888">Nao vinculado a programas de pos-graduacao</p>';
    }
}

// Mark visao-geral as initialized
initializedPages['visao-geral'] = true;
