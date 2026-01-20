import './style.css'
import Worker from './worker?worker'

let worker: Worker | null = null;
let vrpReady = false;

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
    
    // Worker starts init automatically on load, but we can verify or trigger specific init if needed.
    // Our worker calls initialize() at the end of the file, so it starts immediately.
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
    const { sortedIndices, entities, embeddings } = payload;
    renderResult(sortedIndices, entities, embeddings);
    renderMatrix(entities, embeddings);
    setStatus(`Sorted ${entities.length} entities.`);
    sortBtn.disabled = false;
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
