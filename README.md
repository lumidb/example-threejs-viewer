# LumiDB + Three.js Example

An example for rendering point cloud data from LumiDB using Three.js.

## What This Demonstrates

- Connecting to LumiDB and fetching 3D Tiles metadata
- Loading tiles on-demand based on screen-space error (LOD)
- Rendering points with `PointCloudMaterial` or a custom shader

## Usage

```bash
npm install
npm run dev
# open http://localhost:5173
```

Configure your connection via localStorage (or edit the defaults in `src/example-app.ts`):

## Project Structure

- `src/example-app.ts` - Main viewer: Three.js setup, tile fetching, LOD logic
- `src/materials/point.ts` - Example custom shader material (optional)
