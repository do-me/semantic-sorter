import './style.css'
import Worker from './worker?worker'
import { Deck, OrthographicView } from '@deck.gl/core';
import { ScatterplotLayer, PathLayer, TextLayer } from '@deck.gl/layers';

let worker: Worker | null = null;
let vrpReady = false;
let deckInstance: any = null;

// Store current data state for interactive updates
let currentMapData: {
    sortedIndices: number[];
    entities: string[];
    coordinates: number[][];
    embeddings: number[][];
} | null = null;

let sortStartTime = 0;

const layerState = {
    points: true,
    lines: true,
    labels: true,
    scores: false,
    arrows: false,
    radius: 8,
    lineWidth: 3,
    labelSize: 14
};

const inputText = document.getElementById('input-text') as HTMLTextAreaElement;
const sortBtn = document.getElementById('sort-btn') as HTMLButtonElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const outputList = document.getElementById('output-list') as HTMLDivElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const matrixTableContainer = document.querySelector('.overflow-x-auto') as HTMLDivElement;
if (matrixTableContainer) {
    matrixTableContainer.classList.add('matrix-tbl-container');
}

// Bind layer controls
const bindLayerControl = (id: string, key: keyof typeof layerState) => {
    const el = document.getElementById(id) as HTMLInputElement;
    if (el) {
        if (el.type === 'checkbox') {
             el.onchange = (e) => {
                (layerState as any)[key] = (e.target as HTMLInputElement).checked;
                if (currentMapData) {
                    renderMap(currentMapData.sortedIndices, currentMapData.entities, currentMapData.coordinates);
                }
            };
        } else if (el.type === 'range') {
             el.oninput = (e) => {
                (layerState as any)[key] = parseFloat((e.target as HTMLInputElement).value);
                if (currentMapData) {
                    renderMap(currentMapData.sortedIndices, currentMapData.entities, currentMapData.coordinates);
                }
             };
        }
    }
};

bindLayerControl('layer-points', 'points');
bindLayerControl('layer-lines', 'lines');
bindLayerControl('layer-pt-labels', 'labels');
bindLayerControl('layer-ln-scores', 'scores');
bindLayerControl('layer-arrows', 'arrows');
bindLayerControl('param-radius', 'radius');
bindLayerControl('param-linewidth', 'lineWidth');
bindLayerControl('param-labelsize', 'labelSize');

const btnFullscreen = document.getElementById('btn-fullscreen');
if (btnFullscreen) {
    btnFullscreen.onclick = () => {
        const container = document.getElementById('deck-container');
        if (container) {
            if (!document.fullscreenElement) {
                container.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        }
    };
}

if (copyBtn) {
    copyBtn.onclick = () => {
        if (!currentMapData) return;
        const text = currentMapData.sortedIndices
            .map(idx => currentMapData!.entities[idx])
            .join('\n');
        navigator.clipboard.writeText(text).then(() => {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = 'SYNCED_TO_CLIPBOARD';
            setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 2000);
        });
    };
}

const setStatus = (msg: string) => {
  statusDiv.innerHTML = `<span class="text-blue-500 opacity-50 shrink-0 select-none">></span> <span class="truncate">${msg}</span>`;
}

const initialize = async () => {
    setStatus('SYSTEM_INITIALIZING: ATTACHING_WORKER_CORE');
    initDeck();
    worker = new Worker();
    worker.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'READY') {
            vrpReady = true;
            setStatus('SYSTEM_READY: COMPUTE_DOCK_ESTABLISHED');
            sortBtn.disabled = false;
        } else if (type === 'STATUS') {
            setStatus(`TASK_PROGRESS: ${String(payload).toUpperCase()}`);
        } else if (type === 'ERROR') {
            console.error(payload);
            setStatus(`FATAL_EXCEPTION: ${payload}`);
            sortBtn.disabled = false;
        } else if (type === 'SORTED') {
            handleSorted(payload);
        }
    };
}

function initDeck() {
    deckInstance = new Deck({
        canvas: 'deck-canvas',
        width: '100%',
        height: '100%',
        initialViewState: {
            target: [0, 0, 0],
            zoom: 1
        },
        controller: true,
        views: new OrthographicView({
            id: 'ortho', 
            controller: true
        }),
        layers: []
    });
}

const runSort = () => {
  if (!worker || !vrpReady) return;
  const text = inputText.value.trim();
  if (!text) return;
  const entities = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (entities.length < 2) {
    setStatus('VALIDATION_ERROR: NULL_SET_OR_INSUFFICIENT_NODES');
    return;
  }
  sortBtn.disabled = true;
  setStatus('PIPELINE_START: DISTRIBUTING_WORKLOAD');
  sortStartTime = performance.now();
  worker.postMessage({ type: 'SORT', payload: entities });
}

function handleSorted(payload: any) {
    const { sortedIndices, entities, embeddings, coordinates } = payload;
    const durationMs = performance.now() - sortStartTime;
    const perEntityMs = durationMs / entities.length;
    currentMapData = { sortedIndices, entities, embeddings, coordinates };
    renderResult(sortedIndices, entities, embeddings);
    renderMatrix(entities, embeddings);
    renderMap(sortedIndices, entities, coordinates);
    setStatus(`OPTM_COMPLETE: ${entities.length} NODES // TOTAL: ${durationMs.toFixed(0)}MS // UNIT: ${perEntityMs.toFixed(1)}MS/NODE`);
    sortBtn.disabled = false;
}

function flyToEntity(targetIndex: number) {
    if (!currentMapData || !deckInstance) return;
    const { coordinates } = currentMapData;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    coordinates.forEach(c => {
        minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
        minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
    });
    const scale = 200 / Math.max(maxX - minX || 1, maxY - minY || 1);
    const c = coordinates[targetIndex];
    if (c) {
        deckInstance.setProps({
            initialViewState: {
                target: [(c[0] - (minX + maxX)/2) * scale, (c[1] - (minY + maxY)/2) * scale, 0],
                zoom: 3,
                transitionDuration: 800
            }
        });
    }
}

function renderMap(sortedIndices: number[], entities: string[], coordinates: number[][]) {
    if (!deckInstance) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    coordinates.forEach(c => {
        minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
        minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
    });
    const scale = 200 / Math.max(maxX - minX || 1, maxY - minY || 1);
    const scaledCoords = coordinates.map(c => [
        (c[0] - (minX + maxX)/2) * scale,
        (c[1] - (minY + maxY)/2) * scale
    ]);
    const pointsData = scaledCoords.map((c, i) => ({ position: c, text: entities[i], index: i }));

    const pathData = [];
    const scoreData = [];
    const arrowPathData: any[] = [];

    for (let i = 0; i < sortedIndices.length - 1; i++) {
        const f = sortedIndices[i], t = sortedIndices[i+1];
        const p1 = scaledCoords[f], p2 = scaledCoords[t];
        pathData.push({ path: [p1, p2] });
        if (currentMapData?.embeddings) {
            const sim = (1 - getDistance(currentMapData.embeddings[f], currentMapData.embeddings[t])).toFixed(2);
            scoreData.push({ position: [(p1[0]+p2[0])/2, (p1[1]+p2[1])/2], text: sim });
        }
        const dx = p2[0]-p1[0], dy = p2[1]-p1[1], len = Math.sqrt(dx*dx+dy*dy);
        if (len > 0.1) {
            const ax = p1[0]+dx*0.6, ay = p1[1]+dy*0.6;
            const ux = dx/len, uy = dy/len, vx = -uy, vy = ux;
            const sz = Math.max(4, layerState.lineWidth * 2.5);
            const bx = ax-ux*sz, by = ay-uy*sz;
            arrowPathData.push({ path: [[bx+vx*sz*0.6, by+vy*sz*0.6], [ax, ay], [bx-vx*sz*0.6, by-vy*sz*0.6]] });
        }
    }

    const layers = [];
    if (layerState.lines) layers.push(new PathLayer({ id: 'path-layer', data: pathData, widthMinPixels: 1, getPath: (d: any) => d.path, getColor: [30, 41, 59], getWidth: layerState.lineWidth }));
    if (layerState.arrows) layers.push(new PathLayer({ id: 'arrow-layer', data: arrowPathData, widthMinPixels: 1, getPath: (d: any) => d.path, getColor: [59, 130, 246], getWidth: Math.max(2, layerState.lineWidth * 0.7), capRounded: true, jointRounded: true }));
    if (layerState.scores) layers.push(new TextLayer({ id: 'score-layer', data: scoreData, getPosition: (d: any) => d.position, getText: (d: any) => d.text, getSize: 12, getColor: [59, 130, 246], backgroundColor: [11, 15, 26, 220], fontFamily: 'Monospace' }));
    if (layerState.points) layers.push(new ScatterplotLayer({ id: 'scatter-layer', data: pointsData, pickable: true, opacity: 1, stroked: false, filled: true, radiusMinPixels: 4, getPosition: (d: any) => d.position, getFillColor: [37, 99, 235], getRadius: layerState.radius, onClick: (info: any) => info.object && flyToEntity(info.object.index) }));
    if (layerState.labels) layers.push(new TextLayer({ id: 'text-layer', data: pointsData, getPosition: (d: any) => d.position, getText: (d: any) => d.text, getSize: layerState.labelSize, getTextAnchor: 'middle', getAlignmentBaseline: 'center', pixelOffset: [0, -(layerState.radius + layerState.labelSize + 4)], getColor: [255, 255, 255, 160], fontFamily: 'system-ui' }));

    deckInstance.setProps({ layers, initialViewState: { target: [0, 0, 0], zoom: 1 } });
}

function cosineSimilarity(a: number[], b: number[]) {
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
    return dot / (Math.sqrt(nA) * Math.sqrt(nB));
}
function getDistance(a: number[], b: number[]) { return Math.max(0, 1 - cosineSimilarity(a, b)); }

function renderResult(indices: number[], entities: string[], embeddings: number[][]) {
    outputList.innerHTML = '';
    indices.forEach((idx, i) => {
        const sim = i > 0 ? (1 - getDistance(embeddings[indices[i-1]], embeddings[idx])).toFixed(4) : '';
        const el = document.createElement('div');
        el.className = 'p-3 bg-slate-950/40 border border-slate-800/40 rounded flex items-center gap-4 animate-fade-in group hover:bg-slate-900 transition-all cursor-pointer hover:border-blue-500/30';
        el.innerHTML = `<span class="text-[11px] text-slate-700 font-mono w-5">${(i+1).toString().padStart(2, '0')}</span><span class="text-slate-300 text-sm truncate max-w-[320px] font-medium">${entities[idx]}</span>${sim ? `<span class="text-[11px] text-slate-700 font-mono ml-auto tracking-tighter">SIM_${sim}</span>` : ''}`;
        el.onclick = () => flyToEntity(idx);
        el.style.animationDelay = `${i * 20}ms`;
        outputList.appendChild(el);
    });
}

function renderMatrix(entities: string[], embeddings: number[][]) {
    const table = document.getElementById('matrix-table') as HTMLTableElement;
    const threshIn = document.getElementById('sim-threshold') as HTMLInputElement;
    const threshVal = document.getElementById('sim-threshold-val') as HTMLSpanElement;
    if (!table) return;
    const thead = table.querySelector('thead tr');
    if (thead) thead.innerHTML = '<th class="px-5 py-4 border-b border-slate-800 font-bold uppercase tracking-widest text-slate-600 text-[12px]">UID</th>' + entities.map((_, i) => `<th class="px-3 py-4 border-b border-slate-800 text-center text-[11px] text-slate-700 font-bold">${(i+1).toString().padStart(2, '0')}</th>`).join('');
    const tbody = table.querySelector('tbody');
    if (tbody) tbody.innerHTML = entities.map((e, i) => `<tr class="hover:bg-slate-900 border-b border-slate-800/20"><td class="px-5 py-3 font-medium text-slate-500 whitespace-nowrap max-w-[240px] truncate cursor-pointer hover:text-blue-400 transition-colors" title="Focus entity" onclick="window.dispatchEvent(new CustomEvent('flyTo', {detail: ${i}}))"><span class="text-slate-700 font-mono text-[11px] mr-3">${(i+1).toString().padStart(2, '0')}</span><span class="text-[13px] font-medium">${e}</span></td>${entities.map((_, j) => { const s = (1 - getDistance(embeddings[i], embeddings[j])).toFixed(3); return `<td class="p-2 px-3 text-center matrix-cell transition-all duration-200 text-[12px] ${i===j ? 'bg-slate-900/50 text-white font-bold' : ''}" style="--sim: ${s}">${s}</td>`; }).join('')}</tr>`).join('');
    if (!window['flyToListenerAttached' as any]) { window.addEventListener('flyTo', (e: any) => flyToEntity(e.detail)); (window as any)['flyToListenerAttached'] = true; }
    if (threshIn) {
        const update = (v: number) => { threshVal.textContent = v.toFixed(2); table.parentElement?.style.setProperty('--threshold', v.toString()); };
        update(parseFloat(threshIn.value));
        threshIn.oninput = (e) => update(parseFloat((e.target as HTMLInputElement).value));
    }
}

sortBtn.addEventListener('click', runSort);
initialize();
