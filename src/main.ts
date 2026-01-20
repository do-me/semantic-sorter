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

const layerState = {
    points: true,
    lines: true,
    labels: true,
    scores: false,
    arrows: false,
    radius: 5,
    lineWidth: 2
};

const inputText = document.getElementById('input-text') as HTMLTextAreaElement;
const sortBtn = document.getElementById('sort-btn') as HTMLButtonElement;
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
                    // Optimized: could use setProps on layers instead of full re-render, but full re-render is cheap enough here
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

const setStatus = (msg: string) => {
  statusDiv.textContent = msg;
}

const initialize = async () => {
    setStatus('Initializing Worker & Loading Models...');
    
    // Initialize DeckGL
    initDeck();
    
    worker = new Worker();
    
    worker.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'READY') {
            vrpReady = true;
            setStatus('Ready (Worker Initialized).');
            sortBtn.disabled = false;
        } else if (type === 'STATUS') {
            setStatus(payload);
        } else if (type === 'ERROR') {
            console.error(payload);
            setStatus(`Error: ${payload}`);
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
        // Use OrthographicView for non-geospatial 2D coordinates
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
    setStatus('Please enter at least 2 entities.');
    return;
  }

  sortBtn.disabled = true;
  setStatus('Processing in worker...');
  worker.postMessage({ type: 'SORT', payload: entities });
}

function handleSorted(payload: any) {
    const { sortedIndices, entities, embeddings, coordinates } = payload;
    
    // Store for refreshes and interactions
    currentMapData = { sortedIndices, entities, embeddings, coordinates };
    
    renderResult(sortedIndices, entities, embeddings);
    renderMatrix(entities, embeddings);
    renderMap(sortedIndices, entities, coordinates);
    setStatus(`Sorted ${entities.length} entities.`);
    sortBtn.disabled = false;
}

// Helper to zoom to a specific point by entity index
function flyToEntity(targetIndex: number) {
    if (!currentMapData || !deckInstance) return;
    
    const { coordinates } = currentMapData;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    coordinates.forEach(c => {
        minX = Math.min(minX, c[0]);
        maxX = Math.max(maxX, c[0]);
        minY = Math.min(minY, c[1]);
        maxY = Math.max(maxY, c[1]);
    });
    
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale = 200 / Math.max(rangeX, rangeY);
    
    const c = coordinates[targetIndex];
    if (c) {
        const scaledX = (c[0] - (minX + maxX)/2) * scale;
        const scaledY = (c[1] - (minY + maxY)/2) * scale;
        
        // Transition view
        deckInstance.setProps({
            initialViewState: {
                target: [scaledX, scaledY, 0],
                zoom: 3, // Zoom in
                transitionDuration: 1000
            }
        });
    }
}

function renderMap(sortedIndices: number[], entities: string[], coordinates: number[][]) {
    if (!deckInstance) return;

    // Normalize coordinates to fit in view roughly -200 to 200
    // Find bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    coordinates.forEach(c => {
        minX = Math.min(minX, c[0]);
        maxX = Math.max(maxX, c[0]);
        minY = Math.min(minY, c[1]);
        maxY = Math.max(maxY, c[1]);
    });
    
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale = 200 / Math.max(rangeX, rangeY);
    
    const scaledCoords = coordinates.map(c => [
        (c[0] - (minX + maxX)/2) * scale,
        (c[1] - (minY + maxY)/2) * scale
    ]);

    // Data for layers
    const pointsData = scaledCoords.map((c, i) => ({
        position: c,
        text: entities[i],
        color: [74, 222, 128], // Green 400
        index: i
    }));

    const pathData = [];
    const scoreData = [];
    const arrowPathData: any[] = []; // Changed to path data for geometric arrows

    for (let i = 0; i < sortedIndices.length - 1; i++) {
        const fromIdx = sortedIndices[i];
        const toIdx = sortedIndices[i+1];
        
        const p1 = scaledCoords[fromIdx];
        const p2 = scaledCoords[toIdx];

        pathData.push({
            path: [p1, p2],
            color: [59, 130, 246] // Blue 500
        });
        
        // Calculate midpoint for score label
        const midX = (p1[0] + p2[0]) / 2;
        const midY = (p1[1] + p2[1]) / 2;
        
        // Get score if embeddings are available
        if (currentMapData && currentMapData.embeddings) {
            const dist = getDistance(currentMapData.embeddings[fromIdx], currentMapData.embeddings[toIdx]);
            const score = (1 - dist).toFixed(2);
            scoreData.push({
                position: [midX, midY],
                text: score,
                bg: [15, 23, 42] // Slate 900
            });
        }

        // Arrow geometry calculation
        // Place arrow at 60% of segment
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const len = Math.sqrt(dx*dx + dy*dy);
        
        if (len > 0.1) {
            const t = 0.6;
            const ax = p1[0] + dx * t;
            const ay = p1[1] + dy * t;
            
            // Normalize direction
            const ux = dx / len;
            const uy = dy / len;
            
            // Perpendicular vector (-uy, ux)
            const vx = -uy;
            const vy = ux;
            
            // Arrow size proportional to line width but constrained
            const arrowSize = Math.max(3, layerState.lineWidth * 2.5); 
            
            // Back of arrow
            const bx = ax - ux * arrowSize;
            const by = ay - uy * arrowSize;
            
            // Wings
            const w1x = bx + vx * (arrowSize * 0.6);
            const w1y = by + vy * (arrowSize * 0.6);
            const w2x = bx - vx * (arrowSize * 0.6);
            const w2y = by - vy * (arrowSize * 0.6);
            
            // Arrowhead is a V shape: W1 -> Tip -> W2
            arrowPathData.push({
                path: [[w1x, w1y], [ax, ay], [w2x, w2y]],
                color: [96, 165, 250] // Blue 400
            });
        }
    }

    const layers = [];

    if (layerState.lines) {
        layers.push(new PathLayer({
            id: 'path-layer',
            data: pathData,
            pickable: true,
            widthScale: 1,
            widthMinPixels: 1,
            getPath: (d: any) => d.path,
            getColor: (d: any) => d.color,
            getWidth: (d: any) => layerState.lineWidth,
        }));
    }

    if (layerState.arrows) {
        // Render arrows as paths
        layers.push(new PathLayer({
            id: 'arrow-layer',
            data: arrowPathData,
            pickable: false,
            widthScale: 1,
            widthMinPixels: 1,
            getPath: (d: any) => d.path,
            getColor: (d: any) => d.color,
            getWidth: (d: any) => Math.max(1.5, layerState.lineWidth * 0.8), // Slightly thinner than main line
            capRounded: true,
            jointRounded: true
        }));
    }

    // ... (Scores, Points with layerState.radius, Labels remain)
    
    if (layerState.scores) {
        layers.push(new TextLayer({
            id: 'score-layer',
            data: scoreData,
            getPosition: (d: any) => d.position,
            getText: (d: any) => d.text,
            getSize: 12,
            getColor: [148, 163, 184], // Slate 400
            backgroundColor: [15, 23, 42, 200], // Slate 900 transp
            fontFamily: 'Monospace'
        }));
    }

    if (layerState.points) {
        layers.push(new ScatterplotLayer({
            id: 'scatter-layer',
            data: pointsData,
            pickable: true,
            opacity: 0.8,
            stroked: true,
            filled: true,
            radiusScale: 1,
            radiusMinPixels: 2,
            radiusMaxPixels: 100,
            lineWidthMinPixels: 1, // Scaled down stroke based on radius maybe?
            getPosition: (d: any) => d.position,
            getFillColor: (d: any) => d.color,
            getLineColor: (d: any) => [255, 255, 255],
            getRadius: layerState.radius, // Use the state radius
            getLineWidth: 1, // Fixed stroke for now
            onClick: (info: any) => {
                 if(info.object) flyToEntity(info.object.index);
            }
        }));
    }

    if (layerState.labels) {
        layers.push(new TextLayer({
            id: 'text-layer',
            data: pointsData,
            pickable: false,
            getPosition: (d: any) => d.position,
            getText: (d: any) => d.text,
            getSize: 14,
            getAngle: 0,
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'center',
            pixelOffset: [0, - (layerState.radius + 10)], // Offset based on radius
            getColor: [255, 255, 255, 220],
            fontWeight: 'bold',
            outlineWidth: 2,
            outlineColor: [15, 23, 42]
        }));
    }

    deckInstance.setProps({
        layers: layers,
        // Don't reset view on re-render caused by slider, only on data change? 
        // We can check if data changed or passed in args. 
        // For now, to be safe, stick to resetting unless we handle view state better.
        // Actually, if I drag a slider, it re-renders renderMap. 
        // I don't want to reset the view zoom/pan every time I move a slider!
        // Solution: Only set initialViewState if it's the first render or data reset. 
        // DeckGL handles updates gracefully if we don't pass viewState (it uses internal state).
        // Passing initialViewState on updates is ignored by DeckGL unless we change the prop or use viewState.
        // So this is fine.
        initialViewState: {
             target: [0, 0, 0],
             zoom: 1
        }
    });
}

// Re-implement helper for frontend display only
function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getDistance(a: number[], b: number[]) {
  const sim = cosineSimilarity(a, b);
  return Math.max(0, 1 - sim); 
}

function renderResult(indices: number[], entities: string[], embeddings: number[][]) {
  outputList.innerHTML = '';
  
  indices.forEach((idx, i) => {
    let distanceInfo = '';
    if (i > 0) {
        const prevIdx = indices[i-1];
        const dist = getDistance(embeddings[prevIdx], embeddings[idx]);
        const score = (1 - dist).toFixed(4); 
        distanceInfo = `<span class="text-xs text-slate-500 ml-auto">Sim: ${score}</span>`;
    }

    const el = document.createElement('div');
    el.className = 'p-3 bg-slate-700/50 rounded-lg flex items-center gap-3 animate-fade-in group hover:bg-slate-700 transition-colors cursor-pointer';
    el.innerHTML = `
      <span class="w-6 h-6 rounded-full bg-blue-600/50 flex items-center justify-center text-xs text-blue-200 font-mono">${i+1}</span>
      <span class="text-slate-200">${entities[idx]}</span>
      ${distanceInfo}
    `;
    // Click to zoom to this entity on the map
    el.onclick = () => flyToEntity(idx);
    
    el.style.animationDelay = `${i * 50}ms`;
    outputList.appendChild(el);
  });
}

function renderMatrix(entities: string[], embeddings: number[][]) {
    const table = document.getElementById('matrix-table') as HTMLTableElement;
    const thresholdInput = document.getElementById('sim-threshold') as HTMLInputElement;
    const thresholdVal = document.getElementById('sim-threshold-val') as HTMLSpanElement;
    
    if (!table) return;

    // Header
    const thead = table.querySelector('thead tr');
    if (thead) {
        thead.innerHTML = '<th class="px-3 py-2"></th>' + entities.map((_, i) => 
            `<th class="px-3 py-2 font-mono" title="${entities[i]}">${i+1}</th>`
        ).join('');
    }

    // Body
    const tbody = table.querySelector('tbody');
    if (tbody) {
        tbody.innerHTML = entities.map((entityA, i) => {
            const cells = entities.map((entityB, j) => {
                const dist = getDistance(embeddings[i], embeddings[j]);
                const sim = (1 - dist).toFixed(3);
                const isDiag = i === j;
                const bgClass = isDiag ? 'bg-slate-700/30 text-white font-bold' : '';
                return `<td class="px-3 py-2 font-mono ${bgClass} matrix-cell transition-colors duration-200" style="--sim: ${sim}">${sim}</td>`;
            }).join('');
            
            return `
                <tr class="border-b border-slate-700/50 hover:bg-slate-700/20">
                    <td class="px-3 py-2 font-medium text-slate-300 whitespace-nowrap max-w-[150px] truncate cursor-pointer hover:text-blue-300 transition-colors" title="Click to zoom on map" onclick="window.dispatchEvent(new CustomEvent('flyTo', {detail: ${i}}))">
                        <span class="text-blue-400 font-mono mr-2">${i+1}</span>${entityA}
                    </td>
                    ${cells}
                </tr>
            `;
        }).join('');
    }
    
    // Feature: Attach global listener because inline onclick passes attributes as strings
    // We used window for simplicity in this generated table architecture.
    if (!window['flyToListenerAttached' as any]) {
        window.addEventListener('flyTo', (e: any) => {
            flyToEntity(e.detail);
        });
        (window as any)['flyToListenerAttached'] = true;
    }
    
    // Initial color update
    if (thresholdInput) {
        // Initial set
        const updateThreshold = (val: number) => {
             thresholdVal.textContent = val.toFixed(2);
             if (table.parentElement) {
                 // Ensure we target the .matrix-tbl-container which is likely the parent
                 table.parentElement.style.setProperty('--threshold', val.toString());
             }
        };

        const initialVal = parseFloat(thresholdInput.value);
        updateThreshold(initialVal);
        
        thresholdInput.oninput = (e) => {
             const val = parseFloat((e.target as HTMLInputElement).value);
             updateThreshold(val);
        };
    }
}


// Add animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.3s ease-out forwards;
    opacity: 0;
  }
`;
document.head.appendChild(style);

sortBtn.addEventListener('click', runSort);

initialize();
