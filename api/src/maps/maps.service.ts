import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { GameMap, Cell, Edge, CellType, SpecialCellType, AttachedAction } from '@blind/shared';
import { SPECIAL_CELL_TYPES } from '@blind/shared';
import { DbService } from '../db.service';
import { CreateMapDto } from './dto/create-map.dto';
import { UpdateCellDto } from './dto/update-cell.dto';
import { ToggleEdgeDto } from './dto/toggle-edge.dto';

function cid(row: number, col: number) { return `r${row}c${col}`; }

function isAdjacent(a: Cell, b: Cell) {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1 && a.id !== b.id;
}

// (dc, dr) → source handle on the FROM cell pointing toward neighbor
const DIR_TO_SRC: Record<string, string> = {
  '0,-1': 'st',  '0,1': 'sb',  '-1,0': 'sl',  '1,0': 'sr',
  '-1,-1': 'stl', '1,-1': 'str', '-1,1': 'sbl', '1,1': 'sbr',
};
const SRC_TO_TGT: Record<string, string> = {
  'st': 'tt', 'sb': 'tb', 'sl': 'tl', 'sr': 'tr',
  'stl': 'ttl', 'str': 'ttr', 'sbl': 'tbl', 'sbr': 'tbr',
};
const TGT_TO_SRC: Record<string, string> = Object.fromEntries(
  Object.entries(SRC_TO_TGT).map(([s, t]) => [t, s])
);
const OPPOSITE_SRC: Record<string, string> = {
  'st': 'sb', 'sb': 'st', 'sl': 'sr', 'sr': 'sl',
  'stl': 'sbr', 'sbr': 'stl', 'str': 'sbl', 'sbl': 'str',
};

const ALL_SRC = ['st', 'sb', 'sl', 'sr', 'stl', 'str', 'sbl', 'sbr'] as const;
const ALL_TGT = ['tt', 'tb', 'tl', 'tr', 'ttl', 'ttr', 'tbl', 'tbr'] as const;

// Source handle on `from` pointing toward `to`
function srcHandle(from: Cell, to: Cell): string {
  return DIR_TO_SRC[`${Math.sign(to.col - from.col)},${Math.sign(to.row - from.row)}`] ?? 'sr';
}

// All src-form faces already occupied on a cell by any existing edge (adjacent or portal)
function occupiedFaces(cellId: string, edges: Edge[], cells: Cell[]): Set<string> {
  const out = new Set<string>();
  for (const e of edges) {
    if (e.from === cellId) {
      if (e.exitHandle) {
        out.add(e.exitHandle); // portal exit
      } else {
        const nb = cells.find(c => c.id === e.to);
        if (nb) out.add(DIR_TO_SRC[`${Math.sign(nb.col - cells.find(c => c.id === cellId)!.col)},${Math.sign(nb.row - cells.find(c => c.id === cellId)!.row)}`] ?? 'sr');
      }
    }
    if (e.to === cellId) {
      if (e.entryHandle) {
        out.add(TGT_TO_SRC[e.entryHandle]); // portal entry → src-form face
      } else {
        const nb = cells.find(c => c.id === e.from);
        const me = cells.find(c => c.id === cellId);
        if (nb && me) out.add(OPPOSITE_SRC[DIR_TO_SRC[`${Math.sign(me.col - nb.col)},${Math.sign(me.row - nb.row)}`] ?? 'sr']);
      }
    }
  }
  return out;
}

// insert_edge(A, B):
//   adjacent: use natural direction handles; block if either face taken; allow if B→A exists (bidirectional pair)
//   non-adjacent: pick any free face on both; block if none available
function resolveEdge(
  src: Cell, tgt: Cell, edges: Edge[], cells: Cell[]
): { portal: false; exitHandle: string; entryHandle: string } | { portal: true; exitHandle: string; entryHandle: string } | null {
  const aSrcH = srcHandle(src, tgt);                 // src-form on A pointing toward B
  const bSrcH = OPPOSITE_SRC[aSrcH];                 // src-form on B pointing toward A (entry face)
  const bTgtH = SRC_TO_TGT[bSrcH];                   // tgt-form on B (entry handle for A→B)
  const aTgtH = SRC_TO_TGT[aSrcH];                   // tgt-form on A (entry handle for B→A)

  if (isAdjacent(src, tgt)) {
    const reverseExists = edges.some(e => e.from === tgt.id && e.to === src.id);
    if (!reverseExists) {
      // Check A's exit face and B's entry face are free
      const aFaces = occupiedFaces(src.id, edges, cells);
      const bFaces = occupiedFaces(tgt.id, edges, cells);
      if (aFaces.has(aSrcH)) return null; // A's direction taken
      if (bFaces.has(bSrcH)) return null; // B's entry face taken
    }
    return { portal: false, exitHandle: aSrcH, entryHandle: bTgtH };
  } else {
    const aFaces = occupiedFaces(src.id, edges, cells);
    const bFaces = occupiedFaces(tgt.id, edges, cells);
    const freeExits = ALL_SRC.filter(h => !aFaces.has(h));

    // If B→A exists, reuse both directions: B's exit → A→B entry; B's entry on A → A→B exit
    const reverseEdge = edges.find(e => e.from === tgt.id && e.to === src.id && e.portal && e.exitHandle && e.entryHandle);
    if (reverseEdge) {
      const entryHandle = SRC_TO_TGT[reverseEdge.exitHandle!];  // same face on B
      const exitHandle = TGT_TO_SRC[reverseEdge.entryHandle!];  // same face on A
      return { portal: true, exitHandle, entryHandle };
    }

    const freeEntries = ALL_TGT.filter(h => !bFaces.has(TGT_TO_SRC[h]));
    if (!freeExits.length || !freeEntries.length) return null;
    const exitHandle = freeExits[Math.floor(Math.random() * freeExits.length)];
    const entryHandle = freeEntries[Math.floor(Math.random() * freeEntries.length)];
    return { portal: true, exitHandle, entryHandle };
  }
}

interface GenOptions {
  density: number;        // 0–100
  chaos: number;          // 0–100
  specialRate: number;    // 0–100
  specialTypes: SpecialCellType[]; // which special types to use
  connectivity: number;   // 0–100
  randomStartEnd?: boolean;
}

function generateMap(name: string, gridW: number, gridH: number, opts: GenOptions): GameMap {
  const { density, chaos, specialRate, specialTypes, connectivity, randomStartEnd } = opts;

  const cellMap = new Map<string, Cell>();
  for (let r = 0; r < gridH; r++)
    for (let c = 0; c < gridW; c++)
      cellMap.set(cid(r, c), { id: cid(r, c), row: r, col: c, type: 'plain' });

  // fixed corners for now; random start/end applied after path is built
  const startCorner = cid(0, 0);
  const endCorner = cid(gridH - 1, gridW - 1);

  const pathIds = new Set<string>([startCorner]);
  const edgePairs = new Set<string>();
  const addEdge = (a: string, b: string) => edgePairs.add([a, b].sort().join('|'));

  // chaos=0 → strong goal bias (weight 5), cardinal only; chaos=100 → weak bias + diagonals allowed
  const goalWeight = Math.round(5 - (chaos / 100) * 4);
  // chaos < 40 → no diagonals; chaos 40–100 → diagonal probability scales up
  const diagProb = chaos < 40 ? 0 : (chaos - 40) / 60;

  const CARDINAL: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1]];
  const DIAGONAL: [number, number][] = [[1,1],[1,-1],[-1,1],[-1,-1]];

  let r = 0, c = 0;
  let steps = 0;
  while ((r !== gridH - 1 || c !== gridW - 1) && steps++ < gridW * gridH * 6) {
    const moves: [number, number][] = [];
    for (const [dr, dc] of CARDINAL) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < gridH && nc >= 0 && nc < gridW) moves.push([dr, dc]);
    }
    if (diagProb > 0) {
      for (const [dr, dc] of DIAGONAL) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < gridH && nc >= 0 && nc < gridW && Math.random() < diagProb)
          moves.push([dr, dc]);
      }
    }
    const weighted: [number, number][] = [];
    for (const [dr, dc] of moves) {
      const isGoalward = (dr > 0 && (gridH - 1 - r) > 0) || (dc > 0 && (gridW - 1 - c) > 0);
      const w = isGoalward ? goalWeight : 1;
      for (let i = 0; i < w; i++) weighted.push([dr, dc]);
    }
    const [dr, dc] = weighted[Math.floor(Math.random() * weighted.length)];
    addEdge(cid(r, c), cid(r + dr, c + dc));
    pathIds.add(cid(r + dr, c + dc));
    r += dr; c += dc;
  }

  // density=0 → 2 branches, density=100 → 8 branches
  const branchCount = Math.round(2 + (density / 100) * 6);
  // density=0 → branch depth 2, density=100 → depth 5
  const branchDepth = Math.round(2 + (density / 100) * 3);

  const pathArr = Array.from(pathIds);
  const ALL_DIRS: [number, number][] = [...CARDINAL, ...DIAGONAL];
  for (let b = 0; b < branchCount; b++) {
    const sc = cellMap.get(pathArr[Math.floor(Math.random() * pathArr.length)])!;
    let br = sc.row, bc = sc.col;
    for (let s = 0; s < 1 + Math.floor(Math.random() * branchDepth); s++) {
      const dirs: [number, number][] = [];
      for (const [dr, dc] of (diagProb > 0 ? ALL_DIRS : CARDINAL)) {
        const nr = br + dr, nc = bc + dc;
        if (nr >= 0 && nr < gridH && nc >= 0 && nc < gridW) dirs.push([dr, dc]);
      }
      if (!dirs.length) break;
      const [dr2, dc2] = dirs[Math.floor(Math.random() * dirs.length)];
      addEdge(cid(br, bc), cid(br + dr2, bc + dc2));
      pathIds.add(cid(br + dr2, bc + dc2));
      br += dr2; bc += dc2;
    }
  }

  // connectivity: add extra edges between nearby path cells
  const connExtra = Math.round((connectivity / 100) * pathIds.size * 0.4);
  const pathList = Array.from(pathIds);
  for (let i = 0; i < connExtra; i++) {
    const aId = pathList[Math.floor(Math.random() * pathList.length)];
    const aCell = cellMap.get(aId)!;
    const neighbors: string[] = [];
    for (const [dr3, dc3] of (diagProb > 0 ? ALL_DIRS : CARDINAL)) {
      const nr = aCell.row + dr3, nc = aCell.col + dc3;
      if (nr >= 0 && nr < gridH && nc >= 0 && nc < gridW) {
        const nId = cid(nr, nc);
        if (pathIds.has(nId)) neighbors.push(nId);
      }
    }
    if (neighbors.length) addEdge(aId, neighbors[Math.floor(Math.random() * neighbors.length)]);
  }

  // assign start/end
  let startId: string;
  let endId: string;
  if (randomStartEnd) {
    const pathArr2 = Array.from(pathIds);
    startId = pathArr2[Math.floor(Math.random() * pathArr2.length)];
    let endIdx: number;
    do { endIdx = Math.floor(Math.random() * pathArr2.length); } while (pathArr2[endIdx] === startId);
    endId = pathArr2[endIdx];
  } else {
    startId = startCorner;
    endId = endCorner;
    // ensure corners are on the path
    pathIds.add(startId);
    pathIds.add(endId);
  }
  cellMap.get(startId)!.type = 'start';
  cellMap.get(endId)!.type = 'end';

  const special: SpecialCellType[] = specialTypes.length > 0 ? specialTypes : SPECIAL_CELL_TYPES;
  const specialProb = specialRate / 100;
  for (const id of pathIds) {
    if (id !== startId && id !== endId && Math.random() < specialProb)
      cellMap.get(id)!.type = special[Math.floor(Math.random() * special.length)];
  }

  const cells = Array.from(cellMap.values());
  const edges: Edge[] = [];
  for (const pair of edgePairs) {
    const [a, b] = pair.split('|');
    const ca = cellMap.get(a)!;
    const cb = cellMap.get(b)!;
    const abSrc = srcHandle(ca, cb);
    const baSrc = srcHandle(cb, ca);
    // jail cells are inward-only: only add the edge that enters jail, never the one that exits
    if (ca.type !== 'jail') edges.push({ from: a, to: b, exitHandle: abSrc, entryHandle: SRC_TO_TGT[baSrc] });
    if (cb.type !== 'jail') edges.push({ from: b, to: a, exitHandle: baSrc, entryHandle: SRC_TO_TGT[abSrc] });
  }

  return { id: 0, name, gridW, gridH, cells, edges, createdAt: new Date().toISOString() };
}

interface MapRow { id: number; name: string; grid_w: number; grid_h: number; cells: string; edges: string; created_at: string; }

function toGameMap(row: MapRow): GameMap {
  const cells = JSON.parse(row.cells) as (import('@blind/shared').Cell & { action?: AttachedAction })[];
  // back-compat: migrate action (singular) → actions (array)
  for (const c of cells) {
    if (c.action && !c.actions) { c.actions = [c.action]; }
    delete c.action;
  }
  return { id: row.id, name: row.name, gridW: row.grid_w, gridH: row.grid_h, cells, edges: JSON.parse(row.edges), createdAt: row.created_at };
}

@Injectable()
export class MapsService implements OnModuleInit {
  constructor(private readonly db: DbService) {}

  onModuleInit() {
    const count = (this.db.db.prepare('SELECT COUNT(*) as n FROM maps').get() as { n: number }).n;
    if (count === 0) {
      const m = generateMap('The Forgotten Dungeon', 8, 6, { density: 40, chaos: 30, specialRate: 30, specialTypes: SPECIAL_CELL_TYPES, connectivity: 20 });
      this.db.db.prepare('INSERT INTO maps (name, grid_w, grid_h, cells, edges, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(m.name, m.gridW, m.gridH, JSON.stringify(m.cells), JSON.stringify(m.edges), m.createdAt);
    }
  }

  findAll(): GameMap[] {
    return (this.db.db.prepare('SELECT * FROM maps ORDER BY created_at DESC').all() as MapRow[]).map(toGameMap);
  }

  findOne(id: number): GameMap {
    const row = this.db.db.prepare('SELECT * FROM maps WHERE id = ?').get(id) as MapRow | undefined;
    if (!row) throw new NotFoundException(`Map ${id} not found`);
    return toGameMap(row);
  }

  create(dto: CreateMapDto): GameMap {
    const opts: GenOptions = {
      density: dto.density ?? 40,
      chaos: dto.chaos ?? 30,
      specialRate: dto.specialRate ?? 30,
      specialTypes: dto.specialTypes ? (dto.specialTypes as SpecialCellType[]) : SPECIAL_CELL_TYPES,
      connectivity: dto.connectivity ?? 20,
      randomStartEnd: dto.randomStartEnd ?? false,
    };
    const m = generateMap(dto.name, dto.gridW, dto.gridH, opts);
    const result = this.db.db.prepare('INSERT INTO maps (name, grid_w, grid_h, cells, edges, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(m.name, m.gridW, m.gridH, JSON.stringify(m.cells), JSON.stringify(m.edges), m.createdAt);
    return this.findOne(Number(result.lastInsertRowid));
  }

  updateName(id: number, name: string): GameMap {
    if (!this.db.db.prepare('SELECT id FROM maps WHERE id = ?').get(id)) throw new NotFoundException(`Map ${id} not found`);
    this.db.db.prepare('UPDATE maps SET name = ? WHERE id = ?').run(name, id);
    return this.findOne(id);
  }

  remove(id: number): void {
    if (!this.db.db.prepare('SELECT id FROM maps WHERE id = ?').get(id)) throw new NotFoundException(`Map ${id} not found`);
    this.db.db.prepare('DELETE FROM maps WHERE id = ?').run(id);
  }

  updateCell(mapId: number, cellId: string, dto: UpdateCellDto): GameMap {
    const map = this.findOne(mapId);
    const cell = map.cells.find(c => c.id === cellId);
    if (!cell) throw new NotFoundException(`Cell ${cellId} not found`);
    if (dto.type) cell.type = dto.type as CellType;
    if (dto.label !== undefined) cell.label = dto.label;
    if ('actions' in dto) cell.actions = dto.actions ? (dto.actions as AttachedAction[]) : undefined;
    if (dto.bossHp !== undefined) cell.bossHp = dto.bossHp;
    this.db.db.prepare('UPDATE maps SET cells = ? WHERE id = ?').run(JSON.stringify(map.cells), mapId);
    if (cell.type === 'jail') {
      map.edges = map.edges.filter(e => e.from !== cellId);
      this.db.db.prepare('UPDATE maps SET edges = ? WHERE id = ?').run(JSON.stringify(map.edges), mapId);
    }
    return map;
  }

  toggleEdge(mapId: number, dto: ToggleEdgeDto): GameMap {
    const map = this.findOne(mapId);
    const { from, to } = dto;
    const fwd = map.edges.findIndex(e => e.from === from && e.to === to);
    if (fwd !== -1) {
      // Remove just this directed edge
      map.edges = map.edges.filter(e => !(e.from === from && e.to === to));
    } else {
      const srcCell = map.cells.find(c => c.id === from);
      const tgtCell = map.cells.find(c => c.id === to);
      // jail cells are inward-only: block adding any outward edge from a jail cell
      if (srcCell?.type === 'jail') {
        return map;
      }
      if (srcCell && tgtCell) {
        const resolved = resolveEdge(srcCell, tgtCell, map.edges, map.cells);
        if (resolved) {
          const { portal, exitHandle, entryHandle } = resolved;
          map.edges.push(portal
            ? { from, to, portal: true, exitHandle, entryHandle }
            : { from, to, exitHandle, entryHandle });
        }
      }
    }
    this.db.db.prepare('UPDATE maps SET edges = ? WHERE id = ?').run(JSON.stringify(map.edges), mapId);
    return map;
  }
}
