import { pipeline, env } from '@huggingface/transformers';
import init, { solve_pragmatic, get_routing_locations } from './vrp-pkg/vrp_cli.js';
import { UMAP } from 'umap-js';

// Configure env
env.allowLocalModels = false;
env.useBrowserCache = true;

let extractor: any = null;
let vrpReady = false;

const ctx: Worker = self as any;

const initialize = async () => {
    try {
        await init();
        vrpReady = true;
        
        // Using WebGPU
        // We need to check if WebGPU is supported in worker context (usually yes in modern browsers)
        extractor = await pipeline('feature-extraction', 'mixedbread-ai/mxbai-embed-xsmall-v1', {
            device: 'webgpu',
            dtype: 'fp32',
        });
        
        ctx.postMessage({ type: 'READY' });
    } catch (e) {
        ctx.postMessage({ type: 'ERROR', payload: `Init error: ${e}` });
    }
};

// Utilities
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

const encodeLoc = (idx: number) => ({ lat: Math.floor(idx / 1000), lng: idx % 1000 });
const decodeLoc = (loc: any) => Math.round(loc.lat * 1000 + loc.lng);

const runSort = async (entities: string[]) => {
    if (!extractor || !vrpReady) {
        ctx.postMessage({ type: 'ERROR', payload: 'Worker not ready' });
        return;
    }

    try {
        ctx.postMessage({ type: 'STATUS', payload: 'Computing embeddings...' });
        
        // 1. Get embeddings
        const output = await extractor(entities, { pooling: 'mean', normalize: true });
        const embeddings = output.tolist();
        
        ctx.postMessage({ type: 'STATUS', payload: 'Projecting with UMAP (2D)...' });
        
        // 2. UMAP Projection
        const umap = new UMAP({
            nComponents: 2,
            nNeighbors: Math.min(15, entities.length - 1), // Adjust for small datasets
            minDist: 0.1,
            spread: 1.0,
        });
        
        const coordinates = umap.fit(embeddings);

        ctx.postMessage({ type: 'STATUS', payload: 'Calculating distance matrix...' });

        // 3. Prepare VRP
        const jobs = entities.map((_, idx) => ({
            id: `job_${idx}`,
            deliveries: [{
                places: [{
                    location: encodeLoc(idx),
                    duration: 0
                }],
                demand: [1]
            }]
        }));

        const vehicle = {
            typeId: "vehicle",
            vehicleIds: ["v1"],
            profile: { matrix: "car" },
            costs: { fixed: 0, distance: 1, time: 0 },
            shifts: [{
                start: { earliest: "2024-01-01T00:00:00Z", location: encodeLoc(0) },
            }],
            capacity: [1000]
        };

        const problem = {
            plan: { jobs: jobs.slice(1) },
            fleet: {
                vehicles: [vehicle],
                profiles: [{ name: "car" }]
            }
        };

        // 4. Routing Locations & Matrix
        // Note: We need to parse WASM output JSON
        const routingLocationsStr = get_routing_locations(problem);
        const routingLocations = JSON.parse(routingLocationsStr);
        
        const size = routingLocations.length;
        const distances: number[] = [];
        
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const u = routingLocations[i];
                const v = routingLocations[j];
                const idxA = decodeLoc(u);
                const idxB = decodeLoc(v);
                
                // Safety check
                if (!embeddings[idxA] || !embeddings[idxB]) {
                   distances.push(20000); 
                   continue;
                }

                const dist = getDistance(embeddings[idxA], embeddings[idxB]);
                distances.push(Math.round(dist * 10000));
            }
        }

        const matrixData = [{
            matrix: "car",
            distances: distances,
            travelTimes: distances
        }];

        ctx.postMessage({ type: 'STATUS', payload: 'Solving TSP (WASM)...' });
        
        const config = {
            termination: { maxTime: 5, maxGenerations: 1000 }
        };

        const solutionStr = solve_pragmatic(problem, matrixData, config);
        const solution = JSON.parse(solutionStr);

        if (solution.tours && solution.tours.length > 0) {
            const tour = solution.tours[0];
            const stops = tour.stops;
            
            const sortedIndices: number[] = [];
            stops.forEach((stop: any) => {
                const locationIdx = decodeLoc(stop.location);
                if (!sortedIndices.includes(locationIdx)) {
                    sortedIndices.push(locationIdx);
                }
            });

            ctx.postMessage({
                type: 'SORTED',
                payload: {
                    sortedIndices,
                    embeddings,
                    coordinates, // 2D array [ [x, y], ... ]
                    entities 
                }
            });
        } else {
            ctx.postMessage({ type: 'ERROR', payload: 'No solution found.' });
        }

    } catch (e) {
        console.error(e);
        ctx.postMessage({ type: 'ERROR', payload: e.toString() });
    }
};

ctx.onmessage = (e) => {
    const { type, payload } = e.data;
    if (type === 'INIT') {
        initialize();
    } else if (type === 'SORT') {
        runSort(payload);
    }
};

initialize();
