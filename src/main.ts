import './style.css'
import { pipeline, env } from '@huggingface/transformers'
import init, { solve_pragmatic, get_routing_locations } from './vrp-pkg/vrp_cli.js'

// Configure env to use local wasm for transformers if needed, but defaults are usually fine.
// We might need to ensure webgpu is available.
env.allowLocalModels = false;
env.useBrowserCache = true;

let extractor: any = null;
let vrpInitialized = false;

const inputText = document.getElementById('input-text') as HTMLTextAreaElement;
const sortBtn = document.getElementById('sort-btn') as HTMLButtonElement;
const outputList = document.getElementById('output-list') as HTMLDivElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

const setStatus = (msg: string) => {
  statusDiv.textContent = msg;
}

const initialize = async () => {
  try {
    setStatus('Initializing VRP engine...');
    await init();
    vrpInitialized = true;
    
    setStatus('Loading Embedding Model (mixedbread-ai/mxbai-embed-xsmall-v1)...');
    // Using WebGPU as requested
    extractor = await pipeline('feature-extraction', 'mixedbread-ai/mxbai-embed-xsmall-v1', {
      device: 'webgpu',
      dtype: 'fp32', // webgpu usually requires f32 or f16
    });
    
    setStatus('Ready.');
    sortBtn.disabled = false;
  } catch (err) {
    console.error(err);
    setStatus(`Error initializing: ${err}`);
  }
}

// Cosine similarity
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

// Distance = 1 - CosineSimilarity (for VRP minimization)
function getDistance(a: number[], b: number[]) {
  const sim = cosineSimilarity(a, b);
  // VRP minimizes distance. Higher similarity = closer = smaller distance.
  // 1 - sim is standard.
  return Math.max(0, 1 - sim); 
}

const runSort = async () => {
  if (!extractor || !vrpInitialized) return;
  
  const text = inputText.value.trim();
  if (!text) return;
  
  const entities = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (entities.length < 2) {
    setStatus('Please enter at least 2 entities.');
    return;
  }

  setStatus('Computing embeddings...');
  sortBtn.disabled = true;

  try {
    // 1. Get embeddings
    const output = await extractor(entities, { pooling: 'mean', normalize: true });
    // output is a Tensor or list. usage: output.tolist()
    const embeddings = output.tolist();

    setStatus('Calculating distance matrix...');

    // 2. Prepare VRP Problem
    // We treat this as a TSP: 1 vehicle, visiting all nodes.
    // To allow visiting in any order and returning to start (or not), we need to configure it.
    // Standard TSP visits all and returns to start.
    // If we want "order these items" effectively finding the shortest path through them:
    // usually open TSP is better (start at any, end at any), but VRP usually needs a depot.
    // Let's assume we start at the first item acting as "depot" or we introduce a dummy depot.
    // For simplicity, let's just make a closed loop TSP tour. The order will be the tour.
    
    // Create jobs for each entity.
    // Encoding index into lat/lng to avoid invalid range > 180
    // lat = index / 180, lng = index % 180 (roughly)
    const encodeLoc = (idx: number) => ({ lat: Math.floor(idx / 1000), lng: idx % 1000 });
    const decodeLoc = (loc: any) => Math.round(loc.lat * 1000 + loc.lng);

    const jobs = entities.map((entity, idx) => ({
      id: `job_${idx}`,
      deliveries: [{
        places: [{
          location: encodeLoc(idx),
          duration: 0
        }],
        demand: [1]
      }]
    }));

    // Define vehicle
    const vehicle = {
      typeId: "vehicle",
      vehicleIds: ["v1"],
      profile: { matrix: "car" },
      costs: { fixed: 0, distance: 1, time: 0 },
      shifts: [{
        start: { earliest: "2024-01-01T00:00:00Z", location: encodeLoc(0) }, // Start at first entity
      }],
      capacity: [1000] // Infinite capacity
    };

    const problem = {
      plan: { jobs: jobs.slice(1) }, // Exclude the first one (depot)
      fleet: {
        vehicles: [vehicle],
        profiles: [{ name: "car" }]
      }
    };

    // 3. Distance Matrix
    
    // We need to pass the full problem to get_routing_locations to know index mapping.
    const routingLocationsStr = get_routing_locations(problem); 
    const routingLocations = JSON.parse(routingLocationsStr); // Returns list of {lat, lng}
    console.log('Routing locations:', routingLocations);
    
    // Calculate matrix size based on routingLocations
    const size = routingLocations.length;
    const distances: number[] = [];
    
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const u = routingLocations[i];
            const v = routingLocations[j];
            const idxA = decodeLoc(u);
            const idxB = decodeLoc(v);
            
            if (!embeddings[idxA] || !embeddings[idxB]) {
              console.error(`Missing embedding for index ${idxA} or ${idxB}`, u, v);
              // Fallback to max distance
              distances.push(20000); 
              continue;
            }

            // idxA/B correspond to entities[idx]
            const dist = getDistance(embeddings[idxA], embeddings[idxB]);
            distances.push(Math.round(dist * 10000));
        }
    }
    
    const matrixData = [{
      matrix: "car",
      distances: distances,
      travelTimes: distances
    }];
    
    setStatus('Solving TSP...');
    const config = {
      termination: { maxTime: 5, maxGenerations: 1000 }
    };
    
    const solutionStr = solve_pragmatic(problem, matrixData, config);
    const solution = JSON.parse(solutionStr);
    
    // 4. Parse Solution
    // The solution should be a list of tours.
    if (solution.tours && solution.tours.length > 0) {
      const tour = solution.tours[0];
      const stops = tour.stops; 
      
      const sortedIndices: number[] = [];
      // Iterate stops.
      stops.forEach((stop: any) => {
         const locationIdx = decodeLoc(stop.location); 
         if (!sortedIndices.includes(locationIdx)) {
             sortedIndices.push(locationIdx);
         }
      });
      
      // Display result
      renderResult(sortedIndices, entities);
      setStatus(`Sorted ${entities.length} entities.`);
    } else {
      setStatus('No solution found.');
    }

  } catch (e) {
    console.error(e);
    setStatus(`Error during processing: ${e}`);
  } finally {
    sortBtn.disabled = false;
  }
}

function renderResult(indices: number[], entities: string[]) {
  outputList.innerHTML = '';
  indices.forEach((idx, i) => {
    const el = document.createElement('div');
    el.className = 'p-3 bg-slate-700/50 rounded-lg flex items-center gap-3 animate-fade-in';
    el.innerHTML = `
      <span class="w-6 h-6 rounded-full bg-blue-600/50 flex items-center justify-center text-xs text-blue-200 font-mono">${i+1}</span>
      <span class="text-slate-200">${entities[idx]}</span>
    `;
    // Add tiny delay for animation effect
    el.style.animationDelay = `${i * 50}ms`;
    outputList.appendChild(el);
  });
}

// Add animation style since we used it
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
