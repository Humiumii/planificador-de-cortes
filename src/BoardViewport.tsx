import { Component, lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BoardDrawing } from './BoardDrawing'
import type { Board, Stock } from './model'

const BoardScene = lazy(() => import('./BoardScene'))

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function BoardViewport({ stock, board, index, selected, onSelect, view }: {
  stock: Stock; board: Board; index: number; selected: string; onSelect: (key: string) => void; view: '2d' | '3d'
}) {
  const drawing = <BoardDrawing stock={stock} board={board} index={index} selected={selected} onSelect={onSelect} />
  if (view === '2d') return drawing

  const fallback = <>
    <p className="scene-message" role="status">No se pudo abrir WebGL. Puedes seguir inspeccionando el tablero en el plano 2D.</p>
    {drawing}
  </>

  return <SceneBoundary fallback={fallback}>
    <Suspense fallback={<p className="scene-loading" role="status">Cargando vista 3D…</p>}>
      <BoardScene stock={stock} board={board} index={index} selected={selected} onSelect={onSelect} fallback={fallback} />
    </Suspense>
  </SceneBoundary>
}
