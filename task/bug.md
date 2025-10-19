$ npx tsc --noEmit
app/page.tsx:5:33 - error TS7016: Could not find a declaration file for module 'gsap/all'. 'C:/Users/hp/Documents/GitHub/game/node_modules/gsap/all.js' implicitly has an 'any' type.
Try `npm i --save-dev @types/gsap` if it exists or add a new declaration (.d.ts) file containing `declare module 'gsap/all';`

5 import { gsap, RoughEase } from "gsap/all";

```

app/page.tsx:9:26 - error TS2554: Expected 1 arguments, but got 0.

9 const animationIdRef = useRef<number>();
~~~~~~

node_modules/@types/react/index.d.ts:1728:24
1728 function useRef<T>(initialValue: T): RefObject<T>;
```

An argument for 'initialValue' was not provided.

app/page.tsx:232:41 - error TS2554: Expected 0 arguments, but got 1.

232 light.target.position.clone(this.position);

```

app/page.tsx:286:36 - error TS2339: Property 'vertices' does not exist on type 'PlaneGeometry'.

286 for (let i = 0; i < geometry.vertices.length; i++) {
~~~~~~~~

app/page.tsx:287:18 - error TS2339: Property 'vertices' does not exist on type 'PlaneGeometry'.

287 geometry.vertices[i].x += (Math.cos(i _ i) + 1 / 2) _ 2;
~~~~~~~~

app/page.tsx:288:18 - error TS2339: Property 'vertices' does not exist on type 'PlaneGeometry'.

288 geometry.vertices[i].y += (Math.cos(i) + 1 / 2) \* 2;
~~~~~~~~

app/page.tsx:289:18 - error TS2339: Property 'vertices' does not exist on type 'PlaneGeometry'.

289 geometry.vertices[i].z = (Math.sin(i _ i _ i) + 1 / 2) \* -4;
~~~~~~~~

app/page.tsx:291:16 - error TS2339: Property 'verticesNeedUpdate' does not exist on type 'PlaneGeometry'.

291 geometry.verticesNeedUpdate = true;
```

app/page.tsx:292:16 - error TS2339: Property 'normalsNeedUpdate' does not exist on type 'PlaneGeometry'.

292 geometry.normalsNeedUpdate = true;

```

app/page.tsx:293:16 - error TS2339: Property 'computeFaceNormals' does not exist on type 'PlaneGeometry'.

293 geometry.computeFaceNormals();
```

app/page.tsx:300:9 - error TS2353: Object literal may only specify known properties, and 'shading' does not exist in type 'Partial<MapColorPropertiesToColorRepresentations<MeshPhongMaterialProperties>>'.

300 shading: THREE.SmoothShading,

```

app/page.tsx:300:24 - error TS2339: Property 'SmoothShading' does not exist on type 'typeof import("C:/Users/hp/Documents/GitHub/game/node_modules/@types/three/build/three.module")'.

300 shading: THREE.SmoothShading,
```

Found 12 errors in the same file, starting at: app/page.tsx:5
