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

## Example

<details>
  <summary>Input</summary>
  
  Above-ground biomass/carbon stock estimates
Riparian land cover change maps
Restoration area maps
Ozone concentration data
Fishing vessel distribution (inferred from VMS/AIS + EO)
Habitat condition maps
Composite index maps based on EO-derived variables
Contaminated site maps (indirect)
Habitat distribution maps
Habitat condition maps
Habitat fragmentation indices
Habitat fragmentation analysis
Habitat change maps (loss of wetlands, deforestation)
Ecosystem extent maps
High-resolution habitat maps
Hazard monitoring maps
High-resolution forest cover maps
Disturbance indicators
Annual deforestatiofforestation rates
Drought monitoring
Disturbance maps
Distribution maps of specific invasive plant species
Habitat fragmentation maps
Global and regional surface temperature datasets
Coral reef health maps (bleaching extent)
Habitat fragmentation maps
Oil spill detection maps
Oceanic fronts maps
Plume tracking for transboundary transport
Ozone layer thickness data (global and regional maps)
Pollution distribution maps (indirect)
Habitat characteristics maps
Maps of potential ASGM activity
Time-series change maps
Green space maps
Marine ecosystem maps
Maps of potential illegal waste sites
Net Primary Production (NPP) maps
Maps showing areas with changes in vegetation composition or health potentially linked to invasive species
Degradation hotspot maps
Mining area expansion maps
Maps of key habitats in drylands
Ocean productivity maps
Oceanographic parameter maps
Ocean temperature profiles
Population density estimates
Ocean current maps
Not applicable / Not directly applicable for EO
Ecosystem extent maps by type
Land productivity maps
Renewable energy installation detection
Land use change maps
Estimates of surface water extent and changes over time
Vegetation health indices
Drought severity indices
Economic exposure maps (e.g. crop type maps, infrastructure maps)
Drought monitoring indices (e.g., VCI)
Drought monitoring data
Change analysis of ecological corridors
Atmospheric CO2/CH4/N2O concentration data
Assessments of habitat condition
Seal habitat suitability maps
Sea surface height measurements
Deforestation/fire/erosion maps within sites
Forest cover maps
Habitat extent and condition maps
Forest cover change maps
Forest cover change maps
Forest cover change
Ecosystem integrity assessments
Forest clearing alerts
Forest/non-forest maps
Forest cover maps for drylands
Sea Surface Temperature (SST) maps
Sea-level rise maps
Forest degradation detection
Forest carbon stock estimates
Glacier mass loss estimates
Agricultural encroachment maps
Biomass estimation
Change detection datasets for these areas
Changes in agricultural areas
Precipitation anomalies
Air pollutant concentration maps
Coastal habitat maps
Coastal mapping
Stratospheric ozone data
Built-up change maps in urban areas
Coastal vegetation health indices (if affected by spills)
Coastline changes
Coastal wetland extent maps
Climate anomaly maps
Surface slick maps
Coastal development mapping
SST, Chlorophyll maps
Time-series of global and regional surface temperature anomalies
Estimates of biomass/carbon stocks
Coastal vulnerability assessments
Wetland coverage maps
Surface water extent maps
Carbon sequestration maps
Climate impact maps
Maps delineating areas of high biodiversity importance
Vegetation index maps (NDVI, NDWI)
Vegetation index maps for stopover sites
Migration corridor maps
settlement delineation maps
Sediment dynamics
Detection of new mining/industrial areas
Change matrices
Time-series of ecosystem condition
Vegetation recovery maps
Vegetation stress indices
VHR imagery of haul-out sites
Water quality indicators
Biomass/carbon stock change estimates (restoration/degradation)
Damage assessment maps for infrastructure
Water clarity maps
Deforestation maps
Disaster extent maps
Direct counts from VHR
Biomass estimates
Atmospheric composition data
anthropogenic emissions
Coral reef health assessments
Deforestation alerts
Habitat suitability maps
Habitat suitability change maps
Connectivity maps
Wetland extent maps
Wetland restoration maps
Time-series of vegetation indices (NDVI, EVI)
Time-series vegetation indices (land productivity/health)
Vegetation change maps
Urban extent maps
Maps of potential nutrient pollution hotspots
Exposure to threats maps
Soil carbon stock estimates
Slum maps (from VHR)
Snow cover maps
Ecosystem condition maps
Soil carbon maps
Maps of vegetation phenology changes
Migration corridor maps
Snow water equivalent estimates (model-based, informed by EO)
Estimates of GHG fluxes
Time-series of habitat extent and condition
SST maps
Soil Organic Carbon (SOC) maps
Vegetation health indices
Connectivity analysis
Chlorophyll concentration maps
built-up characteristics maps (type, age, use..)
Time-series maps of invasive species extent
Urban heat island maps
Various EO-derived products depending on the specific assessment
Time-series of vegetation recovery in restored sites
Wetland land cover change maps
Vegetation structure
Vessel detection maps
Maps of potential above-ground carbon stock changes
Potential data on animal distribution and movement
Population exposure maps
Density maps of fishing effort
Coral reef health maps
Human activity detection
Infrastructure impact maps
Land cover maps
Damage assessment maps
Hazard maps (flood, landslide, wildfire)
Habitat suitability maps for threatened species
Water quality parameter maps (if detectable impacts)
Water quality parameters (turbidity, chlorophyll) if surface plumes occur + base-line conditions
Water inundation maps
Water quality parameter maps (SST, chlorophyll)
water quality maps
Pollution monitoring maps
Critical infrastructure maps
Maps of glacier and snow cover extent and change
Maps identifying degraded areas
Time series of vegetation indices (anomaly maps)
Elevation models
Land use change detection
Wetland condition maps
Wetland boundary maps / Site boundary monitoring
Exposure Maps
Soil moisture anomalies
Emission source mapping (large industrial sites, landfills)
Flood vulnerability maps
Flood risk maps
Estimations of changes in above-ground biomass and carbon sequestration
Species habitat maps
Spatial distribution maps of plastic debris accumulation
Spatial datasets quantifying land-use and sea-use change
Spatial datasets of wetland inventories
Spatial datasets of restoration projects
Spatial datasets of PAs and OECMs
Spatial datasets of extreme weather impacts
Spatial datasets of areas affected by climate-related disasters
Spatial analysis of land cover and infrastructure to identify potential invasion pathways
Land use change maps
Maps of intact/wilderness areas
Road development monitoring
River width time-series
Settlement expansion maps
Marine productivity monitoring
Maps illustrating spatial distribution of atmospheric GHG concentrations
Logging road detection
Land cover change maps
Salinity maps
Ecosystem extent time series
Land cover change maps
Satellite-based CO2 and CH4 emission maps
Maps of affected areas
Maps of forests, wetlands, grasslands
Long-term climate data records for atmospheric, oceanic, and terrestrial domains
Risk maps
Primary productivity maps
Land cover change maps
Land cover conversion maps
Intertidal habitat maps
Phenology maps and trends from vegetation indices
Population density maps
Large point source detection
Protected area maps
Real-time satellite data feeds for early warning systems
Ozone hole extent maps and minimum concentrations
Site degradation assessment
settlement maps
Site condition maps
Habitat extent maps
Oil spill extent maps
Pollution dispersion modeling
Vegetation health change within protected areas
Infrastructure maps
socio-economic proxy indicators and maps
Maps of ecosystem service provision (e.g., based on land cover as proxy)
</details>

<details>
  <summary>Output</summary>
  Above-ground biomass/carbon stock estimates
Forest carbon stock estimates
Soil carbon stock estimates
Soil carbon maps
Soil Organic Carbon (SOC) maps
Net Primary Production (NPP) maps
Primary productivity maps
Land productivity maps
Urban extent maps
Green space maps
Protected area maps
Maps of intact/wilderness areas
Maps delineating areas of high biodiversity importance
Maps identifying degraded areas
Site degradation assessment
Forest degradation detection
Forest/non-forest maps
Forest clearing alerts
Deforestation alerts
Deforestation maps
Annual deforestatiofforestation rates
Deforestation/fire/erosion maps within sites
Habitat change maps (loss of wetlands, deforestation)
Maps of key habitats in drylands
Maps of forests, wetlands, grasslands
Forest cover maps for drylands
Forest cover change
Forest cover change maps
Forest cover maps
High-resolution forest cover maps
High-resolution habitat maps
Species habitat maps
Seal habitat suitability maps
Habitat suitability maps for threatened species
Habitat suitability change maps
Habitat suitability maps
Habitat characteristics maps
Habitat condition maps
Habitat fragmentation indices
Habitat fragmentation analysis
Habitat fragmentation maps
Habitat distribution maps
Habitat extent maps
Habitat extent and condition maps
Assessments of habitat condition
Time-series of habitat extent and condition
Time-series of vegetation recovery in restored sites
Vegetation health change within protected areas
Vegetation health indices
Vegetation stress indices
Vegetation structure
Vegetation recovery maps
Vegetation change maps
Maps of vegetation phenology changes
Phenology maps and trends from vegetation indices
Vegetation index maps for stopover sites
Vegetation index maps (NDVI, NDWI)
Time-series of vegetation indices (NDVI, EVI)
Time series of vegetation indices (anomaly maps)
Time-series vegetation indices (land productivity/health)
Coastal vegetation health indices (if affected by spills)
Coral reef health maps (bleaching extent)
Coral reef health assessments
Coral reef health maps
Intertidal habitat maps
Marine ecosystem maps
Marine productivity monitoring
Fishing vessel distribution (inferred from VMS/AIS + EO)
Vessel detection maps
Oil spill detection maps
Oil spill extent maps
Surface slick maps
Salinity maps
Water clarity maps
water quality maps
Water quality indicators
Water quality parameter maps (if detectable impacts)
Water quality parameters (turbidity, chlorophyll) if surface plumes occur + base-line conditions
Water quality parameter maps (SST, chlorophyll)
Oceanographic parameter maps
Ocean productivity maps
Ocean current maps
Oceanic fronts maps
Ocean temperature profiles
Sea Surface Temperature (SST) maps
Sea surface height measurements
Sea-level rise maps
Elevation models
VHR imagery of haul-out sites
Slum maps (from VHR)
socio-economic proxy indicators and maps
Economic exposure maps (e.g. crop type maps, infrastructure maps)
Agricultural encroachment maps
Changes in agricultural areas
Change analysis of ecological corridors
Time-series of ecosystem condition
Ecosystem extent time series
Ecosystem extent maps by type
Ecosystem extent maps
Ecosystem condition maps
Ecosystem integrity assessments
Maps of ecosystem service provision (e.g., based on land cover as proxy)
Riparian land cover change maps
Wetland land cover change maps
Spatial datasets of wetland inventories
Wetland boundary maps / Site boundary monitoring
Wetland restoration maps
Wetland condition maps
Wetland coverage maps
Wetland extent maps
Coastal wetland extent maps
Coastal habitat maps
Coastal vulnerability assessments
Coastal development mapping
Coastal mapping
Coastline changes
Sediment dynamics
Soil moisture anomalies
Drought severity indices
Drought monitoring indices (e.g., VCI)
Drought monitoring data
Drought monitoring
Precipitation anomalies
Snow water equivalent estimates (model-based, informed by EO)
Glacier mass loss estimates
Maps of glacier and snow cover extent and change
Snow cover maps
Land cover maps
Land cover change maps
Land cover conversion maps
Land use change maps
Land use change detection
Spatial datasets quantifying land-use and sea-use change
Spatial analysis of land cover and infrastructure to identify potential invasion pathways
Maps showing areas with changes in vegetation composition or health potentially linked to invasive species
Distribution maps of specific invasive plant species
Time-series maps of invasive species extent
Potential data on animal distribution and movement
Maps of potential nutrient pollution hotspots
Maps of potential illegal waste sites
Contaminated site maps (indirect)
Pollution distribution maps (indirect)
Pollution monitoring maps
Pollution dispersion modeling
Air pollutant concentration maps
Ozone concentration data
Ozone hole extent maps and minimum concentrations
Ozone layer thickness data (global and regional maps)
Stratospheric ozone data
Atmospheric composition data
Atmospheric CO2/CH4/N2O concentration data
Satellite-based CO2 and CH4 emission maps
Estimates of GHG fluxes
Maps illustrating spatial distribution of atmospheric GHG concentrations
Spatial distribution maps of plastic debris accumulation
Density maps of fishing effort
Population density estimates
Population density maps
Population exposure maps
Exposure to threats maps
Exposure Maps
Chlorophyll concentration maps
SST, Chlorophyll maps
SST maps
Direct counts from VHR
Spatial datasets of PAs and OECMs
Maps of potential ASGM activity
Maps of affected areas
Disaster extent maps
Disturbance maps
Disturbance indicators
Degradation hotspot maps
Urban heat island maps
Climate anomaly maps
Climate impact maps
Infrastructure impact maps
Critical infrastructure maps
Damage assessment maps for infrastructure
Damage assessment maps
Risk maps
Hazard monitoring maps
Hazard maps (flood, landslide, wildfire)
Flood risk maps
Flood vulnerability maps
Water inundation maps
Surface water extent maps
Estimates of surface water extent and changes over time
River width time-series
Time-series change maps
Change detection datasets for these areas
Built-up change maps in urban areas
built-up characteristics maps (type, age, use..)
Composite index maps based on EO-derived variables
Various EO-derived products depending on the specific assessment
Not applicable / Not directly applicable for EO
Change matrices
Connectivity analysis
Connectivity maps
Infrastructure maps
Site condition maps
Migration corridor maps
Road development monitoring
Logging road detection
Human activity detection
Large point source detection
Emission source mapping (large industrial sites, landfills)
anthropogenic emissions
Plume tracking for transboundary transport
Real-time satellite data feeds for early warning systems
Long-term climate data records for atmospheric, oceanic, and terrestrial domains
Global and regional surface temperature datasets
Time-series of global and regional surface temperature anomalies
Spatial datasets of extreme weather impacts
Spatial datasets of areas affected by climate-related disasters
Spatial datasets of restoration projects
Restoration area maps
settlement delineation maps
settlement maps
Settlement expansion maps
Mining area expansion maps
Detection of new mining/industrial areas
Renewable energy installation detection
Biomass estimation
Biomass estimates
Biomass/carbon stock change estimates (restoration/degradation)
Estimates of biomass/carbon stocks
Estimations of changes in above-ground biomass and carbon sequestration
Maps of potential above-ground carbon stock changes
Carbon sequestration maps
</details>

<details>
  <summary>Gemini Pro 2.5 (low thinking) review</summary>
  
Based on the comparison between the input (unsorted/mixed) and the output (sorted), your sorting algorithm worked **very well**, functioning as a **Semantic or Thematic Clustering** engine.

It did not sort alphabetically; instead, it successfully grouped items based on their scientific domain and contextual meaning.

Here is a breakdown of how well it performed:

### 1. Strong Thematic Clustering (The "Logic" is sound)
The algorithm successfully identified and grouped distinct scientific domains. The flow of the sorted list is logical:
*   **Carbon & Soil:** It starts immediately with Biomass, Carbon Stocks, and Soil Organic Carbon.
*   **Vegetation & Forests:** It transitions smoothly into NPP, general productivity, and then a massive block of Forest-specific products (Cover, Change, Degradation).
*   **Habitats & Biodiversity:** It distinguishes "Forests" from "Habitats" (suitability, fragmentation, extent), keeping these related but distinct concepts together.
*   **Marine & Water:** It created a very clean break for the aquatic section, grouping Coral Reefs, Water Quality, SST, and Oceanographic parameters together.
*   **Cryosphere:** It correctly isolated Glacier, Snow, and Ice products into their own cluster.
*   **Atmosphere & Pollution:** Ozone, GHGs, and Air Pollutants are grouped tightly.
*   **Hazards & Disasters:** Floods, Fires, and Risk Maps are grouped near the end.

### 2. Contextual Nuance
The algorithm showed a high degree of "understanding."
*   **Socio-Economic:** It grouped "Slum maps," "Economic exposure," and "Agricultural encroachment" together. These are human-dimension variables, separate from physical variables.
*   **The "Outlier" Handling:** It correctly identified *"Not applicable / Not directly applicable for EO"* and placed it within a section containing methodological or abstract items (like Composite indices), rather than forcing it into a physical category.

### 3. Areas for Improvement (Minor Flaws)
While the clustering is excellent, there are two distinct issues:

**A. The "Split" Categories (Stragglers)**
The algorithm split identical topics between the very top and the very bottom of the list.
*   *Top of list:* "Above-ground biomass/carbon stock estimates", "Forest carbon stock estimates".
*   *Bottom of list:* "Biomass estimation", "Biomass/carbon stock change estimates", "Carbon sequestration maps".
*   *Diagnosis:* The algorithm likely prioritized "Forest" or "Soil" keywords for the first group, but treated general "Biomass" terms as a separate entity, pushing them to the end. Ideally, these should be merged.

**B. Duplicate Handling**
The input list contained duplicates (e.g., "Habitat fragmentation maps," "Forest cover change maps"). The output list **preserved these duplicates**.
*   *Example:* "SST maps" appears in the middle (under Ocean productivity) and "SST maps" appears again slightly lower (under Population exposure/fishing).
*   *Diagnosis:* If the goal was simply to sort, this is fine. If the goal was to clean the data, a de-duplication step is missing.

**C. "Urban" Fragmentation**
*   "Urban extent maps" and "Green space maps" appear early (near Land Productivity).
*   "Built-up change maps in urban areas" appears much later (near Time-series change maps).
*   *Diagnosis:* The algorithm prioritized the word "Change" over the word "Urban" for the second item.

### Final Verdict
**Grade: A-**

The algorithm is highly effective at organizing chaotic geospatial metadata into human-readable, domain-specific categories. It clearly recognizes that "Ozone" belongs with "Atmosphere" and "Coral" belongs with "Marine." If you add a **de-duplication step** and a final pass to **merge split clusters** (specifically the Biomass/Carbon group), it would be perfect.
</details>
