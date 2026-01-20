import './style.css'
import Worker from './worker?worker'
import { Deck, OrthographicView } from '@deck.gl/core';
import { ScatterplotLayer, PathLayer, TextLayer } from '@deck.gl/layers';

let worker: Worker | null = null;
let vrpReady = false;
let deckInstance: any = null;

const inputText = document.getElementById('input-text') as HTMLTextAreaElement;
const sortBtn = document.getElementById('sort-btn') as HTMLButtonElement;
const outputList = document.getElementById('output-list') as HTMLDivElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const matrixTableContainer = document.querySelector('.overflow-x-auto') as HTMLDivElement;
if (matrixTableContainer) {
    matrixTableContainer.classList.add('matrix-tbl-container');
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
    renderResult(sortedIndices, entities, embeddings);
    renderMatrix(entities, embeddings);
    renderMap(sortedIndices, entities, coordinates);
    setStatus(`Sorted ${entities.length} entities.`);
    sortBtn.disabled = false;
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
    for (let i = 0; i < sortedIndices.length - 1; i++) {
        const fromIdx = sortedIndices[i];
        const toIdx = sortedIndices[i+1];
        pathData.push({
            path: [scaledCoords[fromIdx], scaledCoords[toIdx]],
            color: [59, 130, 246] // Blue 500
        });
    }
    // Loop back to start if it's a closed tour? VRP usually closed. 
    // Let's see if indices[0] == indices[last]. If not, we might ideally close it.
    // But let's just draw the path as given.
    
    const layers = [
        new PathLayer({
            id: 'path-layer',
            data: pathData,
            pickable: true,
            widthScale: 2,
            widthMinPixels: 2,
            getPath: (d: any) => d.path,
            getColor: (d: any) => d.color,
            getWidth: (d: any) => 1,
        }),
        new ScatterplotLayer({
            id: 'scatter-layer',
            data: pointsData,
            pickable: true,
            opacity: 0.8,
            stroked: true,
            filled: true,
            radiusScale: 1,
            radiusMinPixels: 5,
            radiusMaxPixels: 20,
            lineWidthMinPixels: 1,
            getPosition: (d: any) => d.position,
            getFillColor: (d: any) => d.color,
            getLineColor: (d: any) => [0, 0, 0],
            getRadius: 5
        }),
        new TextLayer({
            id: 'text-layer',
            data: pointsData,
            pickable: true,
            getPosition: (d: any) => d.position,
            getText: (d: any) => d.text,
            getSize: 16,
            getAngle: 0,
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'center',
            pixelOffset: [0, -15],
            getColor: [255, 255, 255, 200]
        })
    ];

    deckInstance.setProps({
        layers: layers,
        // Reset view to center on data
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
    el.className = 'p-3 bg-slate-700/50 rounded-lg flex items-center gap-3 animate-fade-in group hover:bg-slate-700 transition-colors';
    el.innerHTML = `
      <span class="w-6 h-6 rounded-full bg-blue-600/50 flex items-center justify-center text-xs text-blue-200 font-mono">${i+1}</span>
      <span class="text-slate-200">${entities[idx]}</span>
      ${distanceInfo}
    `;
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
        // Prepare HTML string
        // Note: setting style="--sim: ..." allows CSS to do the coloring
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
                    <td class="px-3 py-2 font-medium text-slate-300 whitespace-nowrap max-w-[150px] truncate" title="${entityA}">
                        <span class="text-blue-400 font-mono mr-2">${i+1}</span>${entityA}
                    </td>
                    ${cells}
                </tr>
            `;
        }).join('');
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
