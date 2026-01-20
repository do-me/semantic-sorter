# Semantic Sorter Technical Documentation

## Overview
Semantic Sorter is a web-based application designed for the semantic sequencing and geometric projection of text entities. The system utilizes local large language model (LLM) inference to generate high-dimensional embeddings, which are subsequent processed for sequence optimization and 2D visualization.

## Architecture and Software Components

### 1. Execution Model
The application implements a multi-threaded architecture using Web Workers to ensure a responsive user interface during computationally intensive tasks.
*   **Main Thread (`src/main.ts`)**: Manages the DOM, user input, state transitions, and the `deck.gl` rendering cycle.
*   **Worker Thread (`src/worker.ts`)**: Encapsulates the embedding generation pipeline, the sequence optimizer, and the dimensionality reduction engine.

### 2. Semantic Embedding Generation
*   **Library**: `@huggingface/transformers` (Transformers.js)
*   **Model**: `mixedbread-ai/mxbai-embed-xsmall-v1` (or configured alternative)
*   **Backend**: Executed via ONNX Runtime with automatic device detection (WebGPU or WebAssembly).
*   **Function**: Converts raw text strings into 384-dimensional dense vectors that capture semantic relationships.

### 3. Manifold Learning and Projection
*   **Library**: `umap-js`
*   **Function**: Implements Uniform Manifold Approximation and Projection (UMAP). It reduces the 384-dimensional embedding space to a 2D metric space for visualization while preserving local and global topological structures.

### 4. Sequence Optimization (TSP)
*   **Implementation**: Heuristic solver based on semantic distance.
*   **Function**: Formulates the sorting task as a Traveling Salesperson Problem (TSP) across the semantic manifold. It minimizes the total cosine distance between sequential nodes to create a logical progression of concepts.

### 5. Data Visualization
*   **Library**: `deck.gl` (utilizing `@deck.gl/core` and `@deck.gl/layers`)
*   **Layers**:
    *   `ScatterplotLayer`: Represents entities as nodes in the projected 2D space.
    *   `PathLayer`: Visualizes the optimized sequence and directionality (vectors).
    *   `TextLayer`: Renders semantic labels and pairwise similarity metrics.
*   **Coordinate System**: Uses an `OrthographicView` to map the UMAP coordinates (scaled to a normalized -200 to 200 range) to the viewport.

### 6. Interface and Styling
*   **Framework**: Tailwind CSS
*   **Components**: Responsive layout with real-time parameter controls (radius, line width, label size, arrow scale, and similarity threshold).

## Data Flow
1.  **Ingestion**: User provides newline-separated text entities.
2.  **Preprocessing**: Optional deduplication and normalization occur on the main thread.
3.  **Inference**: The worker thread generates embeddings using the Transformer model.
4.  **Optimization**: The system calculates a distance matrix and determines the optimal path via a greedy heuristic.
5.  **Manifold Projection**: UMAP generates 2D coordinates for the entire set.
6.  **Rendering**: The main thread receives the computed payload and updates the `deck.gl` instance, the similarity matrix, and the sorted list.

## Development and Deployment
*   **Build Tool**: Vite
*   **Language**: TypeScript
*   **CI/CD**: GitHub Actions workflow (`.github/workflows/deploy.yml`) for automated static site generation and deployment to GitHub Pages.
*   **Security Headers**: Configured with Cross-Origin-Opener-Policy (COOP) and Cross-Origin-Embedder-Policy (COEP) to enable `SharedArrayBuffer` support for high-performance compute in certain environments.
