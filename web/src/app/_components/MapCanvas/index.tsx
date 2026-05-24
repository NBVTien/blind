import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { CELL_SIZE } from './constants'
import { mapToNodes, mapToEdges, buildCellPlayers, buildReachableCells } from './utils'
import { CellNode } from './components/CellNode'
import { CellEdge } from './components/CellEdge'
import { CellTypeMenu } from './components/CellTypeMenu'
import { SessionCellMenu } from './components/SessionCellMenu'
import type { CellNodeData, CellEdgeData, CtxMenu, MapCanvasProps } from './types'

export type { MapCanvasProps } from './types'
export { CELL_COLOR_VARS, CELL_COLORS, CELL_LABELS, ALL_TYPES } from './constants'
export type { CellNodeData } from './types'

const nodeTypes = { cell: CellNode }
const edgeTypes = { cell: CellEdge }

export function MapCanvas(props: MapCanvasProps) {
  const { map } = props
  const editMode = props.mode === 'edit'

  const connectedIds = useMemo(() => new Set(map.edges.map(e => e.from)), [map.edges])

  const selectedPlayer = props.mode === 'session'
    ? (props.players.find(p => p.id === props.selectedPlayerId) ?? null)
    : null

  const reachableCells = useMemo(() => {
    if (!selectedPlayer) return new Set<string>()
    return buildReachableCells(selectedPlayer.currentCellId, map.edges)
  }, [selectedPlayer, map.edges])

  const cellPlayers = useMemo(() => {
    if (props.mode !== 'session') return undefined
    return buildCellPlayers(props.players)
  }, [props.mode === 'session' ? props.players : null])

  const [nodes, setNodes] = useNodesState<Node<CellNodeData>>([])
  const [edges, setEdges] = useEdgesState<Edge<CellEdgeData>>([])
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const ctxMenuRef = useRef<HTMLDivElement | null>(null)
  const [sessionPathFrom, setSessionPathFrom] = useState<string | null>(null)

  const pendingTargetId = props.mode === 'session' ? props.pendingTargetId : null

  const onToggleEdge = props.mode === 'edit' ? props.onToggleEdge : undefined

  useEffect(() => {
    setNodes(mapToNodes(map, connectedIds, editMode, reachableCells, selectedPlayer, pendingTargetId, cellPlayers, editMode ? onToggleEdge : undefined))
  }, [map, connectedIds, editMode, reachableCells, selectedPlayer, pendingTargetId, cellPlayers, onToggleEdge])

  useEffect(() => {
    setEdges(mapToEdges(map, reachableCells, selectedPlayer))
  }, [map, reachableCells, selectedPlayer])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const safe = changes.filter(c => c.type !== 'position' && c.type !== 'dimensions')
    if (safe.length) setNodes(nds => applyNodeChanges(safe, nds) as Node<CellNodeData>[])
  }, [setNodes])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds))
  }, [setEdges])

  const onConnect = useCallback((connection: Connection) => {
    if (!editMode || props.mode !== 'edit') return
    if (connection.source && connection.target && connection.source !== connection.target) {
      props.onToggleEdge(connection.target, connection.source) // bi an cua nhan loai
    }
  }, [editMode, props.mode === 'edit' ? props.onToggleEdge : null])

  const onEdgeClick = useCallback((_e: React.MouseEvent, edge: Edge) => {
    if (!editMode || props.mode !== 'edit') return
    props.onToggleEdge(edge.source, edge.target) 
  }, [editMode, props.mode === 'edit' ? props.onToggleEdge : null])

  const sessionMode = props.mode === 'session'
  const sessionHasMapActions = sessionMode && (
    props.onChangeCellType || props.onCreatePath || props.onDeletePath
  )

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    if (!editMode && !sessionHasMapActions) return
    e.preventDefault()
    e.stopPropagation()
    const cell = map.cells.find(c => c.id === node.id)
    if (!cell) return
    setCtxMenu({ kind: 'cell', cell, x: e.clientX, y: e.clientY })
  }, [editMode, sessionHasMapActions, map.cells])

  const sessionOnCellClick = props.mode === 'session' ? props.onCellClick : undefined
  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (sessionOnCellClick) sessionOnCellClick(node.id)
  }, [sessionOnCellClick])

  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as Element
      if (t === document.body) return
      if (ctxMenuRef.current?.contains(t)) return
      if (t?.closest('[data-radix-popper-content-wrapper]')) return
      setCtxMenu(null)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--map-bg)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={editMode ? onConnect : undefined}
        onEdgeClick={editMode ? onEdgeClick : undefined}
        onNodeContextMenu={onNodeContextMenu}
        onNodeClick={onNodeClick}
        onPaneClick={() => setCtxMenu(null)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={3}
        connectionMode={ConnectionMode.Loose}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={editMode}
        edgesReconnectable={false}
        panOnScroll={true}
        panOnDrag={true}
        zoomOnScroll={false}
        zoomOnPinch={true}
        selectionOnDrag={false}
        preventScrolling={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={CELL_SIZE}
          size={1.5}
          color="var(--map-dot)"
        />
        <Controls
          showInteractive={false}
          showFitView={true}
          fitViewOptions={{ padding: 0.15 }}
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        />
      </ReactFlow>

      <div ref={ctxMenuRef}>
        {ctxMenu && props.mode === 'edit' && (
          <CellTypeMenu
            ctxMenu={ctxMenu}
            onChangeType={props.onChangeType}
            onSetBossHp={props.onSetBossHp}
            onClose={() => setCtxMenu(null)}
          />
        )}

        {ctxMenu && props.mode === 'session' && (props.onChangeCellType || props.onCreatePath || props.onDeletePath) && (
          <SessionCellMenu
            ctxMenu={ctxMenu}
            mapCells={map.cells}
            mapEdges={map.edges}
            pathFrom={sessionPathFrom}
            onSetPathFrom={setSessionPathFrom}
            onChangeCellType={props.onChangeCellType ?? (() => {})}
            onCreatePath={props.onCreatePath ?? (() => {})}
            onDeletePath={props.onDeletePath ?? (() => {})}
            onSetCellAction={props.onSetCellAction}
            sessionItems={props.sessionItems}
            sessionWheels={props.sessionWheels}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </div>
    </div>
  )
}
