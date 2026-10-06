# Workflow editing layout

The workflow harness owns geometry. The model chooses graph structure and configuration, and uses `insert_node` with an existing `connectionId` when inserting into a connection. Coordinates are optional and should be supplied only for explicit user positioning instructions.

## Atomic insertion

`insert_node` creates a configured node, changes the original edge's target, and creates an edge from the new node to the former successor. The original edge retains its ID, source branch handle, label, data, and existing canvas metadata. This metadata belongs to the original source leg; it is not duplicated onto the new leg. Inserting a condition, experiment, or loop requires `sourceHandle` for the **new** node's outgoing leg. The existing source handle is never replaced by that argument.

The tool calculates layout on a private candidate and submits graph changes and position updates through `applyWorkflowOperations` in one batch. Missing connections, invalid configuration/handles, geometry conflicts, frame overflow, and the 100-operation budget all fail before the draft or staged operation list changes. The response contains the new node and all staged operations. Ordinary operation types are used, so both client and server replay the same validated batch. The existing single canvas update/history entry makes graph and geometry changes undo together.

## Deterministic local solver

`src/server/ai/workflow/layout.ts` implements a left-to-right constraint solver:

1. Use absolute bounding boxes from explicit dimensions, measured dimensions normalized at the transport boundary, or the editor's defaults (248 × 180 for ordinary nodes). Minimum clearance is 52 pixels.
2. Keep the insertion predecessor fixed. Prefer the midpoint of the available horizontal interval on the successor's lane. Search free interval boundaries around fixed obstacles before deciding that downstream movement is necessary.
3. Start from inserted/new nodes and targets of added or rewired connections. Only their reachable descendants are eligible to move. Unrelated nodes, other branches before a join, notes, and other frames are fixed obstacles.
4. Visit nodes in stable topological order, breaking ties by ID. Each affected node must clear **all** incoming predecessors. A shared join is solved once after every incoming branch. Move only right, only to the first required clearance boundary; preserve existing y coordinates after insertion.
5. Resolve collisions against fixed obstacles and settled branches. Future affected nodes resolve against the current node when visited. Preserve nodes that already satisfy the constraints. Emit `update_node` only for changed positions.

No random geometry, model-generated coordinates, or whole-canvas auto-layout is used. Generated node/edge IDs remain random identifiers; layout for the same graph, IDs, dimensions, seeds, and pinned positions is deterministic. Rerunning on the resulting graph yields no additional moves. Deletion does not compact existing space. Relabeling nodes/connections and configuration-only changes do not seed layout.

## Frames and explicit positions

Frames remain top-level containers. Insertion inherits the predecessor's `parentId`, including on cross-frame connections. Compute geometry in absolute canvas coordinates and convert emitted positions back to the existing frame's coordinates. Prefer the successor's y lane, clamped to the predecessor frame's content area for automatic insertion. Respect the 44-pixel frame header and frame dimensions.

The solver never resizes a frame, reparents members, or silently allows overflow. Insufficient space produces `layout_conflict`; the insertion remains unstaged. Explicit tool positions are pinned for the request, as are successful insertion predecessors. If those constraints conflict with spacing, collision avoidance, or frame bounds, fail rather than override the instructions. The harness prompt requires explaining the conflict and revising placement or making space explicitly. These positioning preferences are translated into tool arguments by the model; the solver does not parse natural language.

## Review and commitment

The finalization order is **edit graph → adjust layout → technical validation → semantic review → commit**. Mutation tools still validate their individual candidate batches early. At each completion attempt, `finalizeLayout` consumes the pending structural seeds, stages its generated moves, and the harness replays the full operation list for technical validation before calling the read-only semantic reviewer. The reviewer therefore sees the actual positioned draft and all moves.

A semantic implementation repair that adds or rewires graph structure creates new layout seeds. The next completion attempt runs layout, validation, and review again. Configuration/label repairs leave geometry alone. Layout/validation failures never emit `workflow-ready`. The existing client fingerprint check includes geometry and connection data, rejecting stale edits if those inputs changed while the request was running. Model-supplied `add_edge` operations still cannot author arbitrary connection data; existing metadata is retained through request transport and edge updates.

## Limits and tests

This is a local horizontal layout, not a general graph drawing or packing engine. It does not route edges around obstacles, minimize crossings, rotate vertical/reversed flows, pack nodes into alternate vertical lanes, expand frames, or tidy pre-existing unrelated overlaps. A constrained frame may require explicit rearrangement even if a different two-dimensional packing could fit. Missing measurements use conservative defaults; content may change rendered size after commitment. Large shifts can exceed canvas or operation limits and fail atomically.

`tests/server/layout.test.ts` covers free space, fixed obstacles, crowded chains, branch handles, shared joins, explicit positions, frame/cross-frame geometry, metadata/dimension transport, rollback, operation limits, and deterministic idempotence. `tests/server/semantic-review.test.ts` checks that review sees positioned insertion and freshly laid-out structural repairs. Client/server replay tests cover the same operation batch used by canvas history.
