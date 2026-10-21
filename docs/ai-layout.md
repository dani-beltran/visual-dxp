# Workflow editing layout

The AI harness owns geometry. The model authors graph structure and configuration, uses `insert_node` to create a node inside an existing connection, and supplies coordinates only for explicit user positioning instructions. The transaction remains **edit graph → arrange → technical validation → semantic review → commit**.

## Scope and placement

`src/server/ai/workflow/layout.ts` exposes a small layout interface with local and component modes. Component mode uses `@dagrejs/dagre` with `rankdir: LR`, node dimensions, configurable rank/lane spacing (defaults 80/72 pixels, accepted range 52–500), and converts center coordinates to React Flow top-left coordinates.

- Newly generated executable components receive component layout at finalization, including chains created with separate node/connection calls.
- Adding, rewiring or removing connections in a branching component expands the scope to the entire connected executable component. This includes sibling branches, nested forks and shared joins. Existing nodes within that component can move.
- Simple insertions retain the local solver in `localLayout.ts`: keep the predecessor fixed, use free horizontal space, and move reachable downstream nodes only as needed. Both node placement and routed paths must validate before staging. Insertion retains the original connection ID, source handle, label and metadata on the source leg. A new branching node requires its own continuation handle.
- Label/configuration edits and deletion outside a branching component do not arrange nodes. Local AI edits also retain the user's viewport; initial generation on an empty canvas receives a fit after measurement.
- Unrelated components, notes and other frames stay fixed. An unpinned top-level component may translate downward as a unit to clear these obstacles. The engine does not resize containers or pack unrelated workflows together.

For an explicit arrange request, the model can call `arrange_workflow`:

```json
{"scope":"components","nodeIds":["condition-id"],"rankGap":80,"laneGap":72}
```

`components` expands the supplied IDs (or current selection) to their connected components. `workflow` includes all executable components. Frames and notes are obstacles rather than arrange targets. Independent components are processed in stable semantic order; each component retains its requested spacing at finalization. A failed call leaves the staged draft and operation list unchanged.

## Stability and semantic lanes

Dagre receives stable node/edge input ordered by semantic graph paths, kinds and labels. Generated UUIDs are a final tie-break only for indistinguishable nodes on the same output. Branch placement does not depend on UUID ordering.

Dagre's crossing optimizer alone does not guarantee source-port order. After ranking, the adapter packs semantic lanes: **true above false, A above B, body above done**. Nested paths subdivide their parent lanes. Joins use the common prefix of their incoming branch paths and sit between converging lanes. The adapter verifies branch order in its output. True graph cycles remain unsupported; Loop nodes represent finite body/done branches in the executable DAG.

Measured dimensions normalized by the existing request parser take precedence over fallback geometry. Unmeasured cards reserve 248 × 220 pixels, with additional height for long labels. Explicit dimensions are honored. Derived positions use hundredth-pixel precision to avoid floating-point drift. Repeating an arrangement with the same graph, constraints, dimensions and spacing emits no moves.

## Rendered routing

Improved node placement is not treated as proof of obstacle avoidance. `src/lib/workflowGeometry.ts` supplies the orthogonal router used by both finalization and the canvas's `smoothstep` edge renderer (`WorkflowEdge.tsx`). The historical edge type and serialized connection data stay compatible; displayed paths now use straight orthogonal segments.

WorkflowCard's split sockets use shared 38%/68% positions on the outer card, rather than content-dependent nested elements. Server calculations include the card border and socket radius. The renderer additionally reads React Flow's actual measured handle bounds and attaches paths to those exact endpoints.

Routing uses coordinate-compressed search with clearance around node rectangles and direction-preserving source/target stubs. Notes and unrelated nodes/frames are obstacles. A frame containing an endpoint is a container; paths between members of the same frame stay within its content bounds. Cross-frame paths can cross the boundaries of their endpoint frames, while avoiding other members and unrelated frames. The cost penalizes bends, crossings, T intersections and shared segments. Short convergence/divergence stubs at a common endpoint are legitimate.

Finalization checks every affected edge's routed path for unrelated node intersections and rejects missing routes with `layout_conflict`. The canvas uses the same search, with actual measured ports. Routes are derived view state, never arbitrary model-authored edge metadata or additional operations. Geometry, handles, dimensions, connections, drag, resize, undo and redo invalidate the shared renderer cache. Thus no stored control points can outlive their geometry.

React Flow's existing `onNodesChange` measurement flow updates routing as newly created cards are measured. Measurement never triggers another position layout, so there is no measurement/layout loop or second undo entry. Conservative reservations reduce the need for movement after first measurement. A user can explicitly arrange again using the measured dimensions.

## Pins, frames and failures

Explicit tool positions are request pins, including a position equal to a provisional automatic move. A component can translate around a pin only when every other pin agrees with that layout. Pinned positions are checked against the final geometry; the solver never restores them over an unchecked arrangement. Contradictory constraints fail atomically.

Nodes retain their existing `parentId` and frame-relative coordinates. Frames remain fixed top-level containers with a 44-pixel header. Node overflow, obstacle collisions, insufficient routing space and incompatible pins fail before publishing layout. Component arrangement spanning frame boundaries is explicitly unsupported and fails atomically. Local insertion across frames remains supported when it fits the predecessor's frame and its final paths validate. The model must explain conflicts and revise the requested placement or make space explicitly.

## Transaction, replay and undo

The tool kit records semantic edits separately from derived positions. At each completion attempt it rebuilds from the original workflow plus semantic ledger, recalculates surviving insertions and scoped arrangements, and emits at most one final derived position per node. Temporary edits therefore cannot leave provisional spacing behind. Repeated finalization replaces prior derived moves and does not append moves or accumulate drift.

The complete replacement batch must pass the 100-operation budget and technical validation before either the draft or staged operations change. Layout failures never reach semantic review or emit `workflow-ready`. Successful review receives the final positioned draft and its complete batch. Repairs that change structure repeat layout, validation and review. Client/server replay continues to use ordinary `add_node`, `update_node` and connection operations. The existing fingerprint check rejects stale canvases, and a single client commit makes graph and geometry undo together even when both ready and result events arrive.

## Guarantees, limits and verification

For successfully finalized affected geometry, node rectangles clear obstacles, branch order is verified, frames contain their members, pins hold, and routed affected edges clear unrelated nodes using the available dimensions. Crossings and ambiguous overlap are penalized, not globally eliminated: dense/non-planar graphs may retain crossings. Routing is bounded to 25,000 search states per edge; exhausted or constrained routes fail explicitly. Layout is not an optimal packing solver, a constrained Dagre arrangement may fail even when another packing exists, and arbitrary multi-pin or cross-frame component layouts are unsupported.

Measurements, responsive styles or subsequent user edits can invalidate geometry. Paths reroute immediately, but positions are intentionally not moved automatically. If a manually edited graph has no route, the renderer shows a dashed direct connection; this is an invalid-route indication, not an obstacle-avoidance guarantee. Large content growth can require another explicit arrange request. Imported edge types other than `smoothstep` retain their existing renderer.

`tests/server/layout.test.ts` retains local insertion, unrelated preservation, metadata transport, cross-frame insertion and temporary-edit cleanup regressions. `tests/server/dagre-layout.test.ts` checks rendered polyline geometry for generated diamonds, unequal branches, skip ranks, nested forks/experiments/loops, shared joins, pins, notes, frames/overflow, dimensions, UUID-independent branch order, fractional-dimension idempotence, rollback, limits and client/server replay. Semantic review tests verify the final positioned draft. Builder integration checks one undo entry for semantic edits plus layout, including duplicate ready/result delivery.

For browser verification, run `pnpm exec vite --host 127.0.0.1` and open `/tests/browser/layout.html`. This isolated fixture uses the real builder, node cards, sockets and edge renderer. Choose condition, experiment, loop or nested unequal branches. Its status samples displayed SVG paths against actual card rectangles, checks unrelated edge intersections, verifies socket attachment and server port predictions, and checks position stability after measurement. A separate case exercises explicit cards with different dimensions. Edit a label, drag a node and undo to check routing lifecycle and local placement.
