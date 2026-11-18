import { createRoot } from 'react-dom/client'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { format, pieceColor } from './BoardDrawing'
import { BoardViewport } from './BoardViewport'
import { examplePieces, exampleStock, placementKey } from './model'
import type { Piece, Stock } from './model'
import { calculate } from './engine'
import type { Strategy } from './engine'
import { downloadPlan } from './exportPlan'
import './style.css'

const strategies = [
  { id: 'area', label: 'Área descendente' },
  { id: 'side', label: 'Lado mayor descendente' },
] as const

function compare(stock: Stock, pieces: Piece[]) {
  return { stock, pieces, plans: { area: calculate(stock, pieces, 'area'), side: calculate(stock, pieces, 'side') } }
}

function NumberField({ label, value, onChange, min = 0.01, max = 10000, step = 0.01 }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number
}) {
  return <label>{label}<input name={label} type="number" inputMode={step === 1 ? 'numeric' : 'decimal'} required min={min} max={max} step={step}
    value={Number.isNaN(value) ? '' : value} onChange={event => onChange(event.target.valueAsNumber)} /></label>
}

function App() {
  const [stock, setStock] = useState(exampleStock)
  const [pieces, setPieces] = useState(examplePieces)
  const [nextId, setNextId] = useState(4)
  const [result, setResult] = useState(() => compare(exampleStock, examplePieces))
  const [strategy, setStrategy] = useState<Strategy>('area')
  const [view, setView] = useState<'2d' | '3d'>('2d')
  const [boardIndex, setBoardIndex] = useState(0)
  const [selected, setSelected] = useState('')
  const [editing, setEditing] = useState(false)
  const [exportError, setExportError] = useState('')
  const planTitle = useRef<HTMLHeadingElement>(null)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  function editStock(field: keyof Stock, value: number) {
    setStock(previous => ({ ...previous, [field]: value }))
    setDirty(true)
  }

  function editPiece(id: number, change: Partial<Piece>) {
    setPieces(previous => previous.map(piece => piece.id === id ? { ...piece, ...change } : piece))
    setDirty(true)
  }

  function addPiece() {
    setPieces(previous => [...previous, { id: nextId, name: '', width: 300, length: 300, quantity: 1, rotate: true }])
    setNextId(nextId + 1)
    setDirty(true)
  }

  function reset() {
    setEditing(false)
    setStock(exampleStock)
    setPieces(examplePieces)
    setNextId(4)
    setResult(compare(exampleStock, examplePieces))
    setStrategy('area')
    setBoardIndex(0)
    setSelected('')
    setExportError('')
    setError('')
    setDirty(false)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const count = pieces.reduce((total, piece) => total + piece.quantity, 0)
    if (count < 1 || count > 1000) {
      setError('Ingresa entre 1 y 1000 piezas en total.')
      return
    }
    setError('')
    setResult(compare(stock, pieces))
    setBoardIndex(0)
    setSelected('')
    setExportError('')
    setDirty(false)
    if (matchMedia('(max-width: 760px)').matches) {
      setEditing(false)
      planTitle.current?.focus()
    }
  }

  const stockField = (field: keyof Stock, label: string, options?: { min?: number; max?: number; step?: number }) =>
    <NumberField label={label} value={stock[field]} onChange={value => editStock(field, value)} {...options} />

  const { plans, stock: usedStock } = result
  const plan = plans[strategy]
  const strategyLabel = strategies.find(item => item.id === strategy)!.label
  const pending = new Map<number, { name: string; count: number }>()
  for (const { piece } of plan.unplaced) {
    const previous = pending.get(piece.id)
    pending.set(piece.id, { name: piece.name, count: (previous?.count ?? 0) + 1 })
  }

  const alternative = strategy === 'area' ? 'side' : 'area'
  const other = plans[alternative]
  const difference = (value: number) => value > 0 ? `+${format(value)}` : format(value)
  const board = plan.boards[boardIndex]
  const selectedPiece = board?.placements.find(piece => placementKey(piece) === selected)
  const metrics = [
    { label: 'Tableros usados', value: `${plan.boards.length} de ${usedStock.quantity}`, delta: plan.boards.length - other.boards.length, unit: '' },
    { label: 'Piezas ubicadas', value: `${plan.placed} de ${plan.total}`, delta: plan.placed - other.placed, unit: '' },
    { label: 'Aprovechamiento', value: `${format(plan.utilization)} %`, delta: Number((plan.utilization - other.utilization).toFixed(2)), unit: ' pp' },
  ]

  function chooseStrategy(next: Strategy) {
    setStrategy(next)
    const nextBoards = plans[next].boards
    const selectedBoard = selectedPiece ? nextBoards.findIndex(item =>
      item.placements.some(placement => placementKey(placement) === selected)) : -1
    if (selectedBoard >= 0) setBoardIndex(selectedBoard)
    else {
      setBoardIndex(index => Math.min(index, Math.max(0, nextBoards.length - 1)))
      setSelected('')
    }
  }

  async function exportActivePlan() {
    setExportError('')
    try {
      const { downloadPlan } = await import('./exportPlan')
      downloadPlan(strategy, strategyLabel, usedStock, result.pieces, plan)
    } catch {
      setExportError('No se pudo descargar el plano. Intenta de nuevo.')
    }
  }

  return <>
    <header className="topbar">
      <div className="brand"><span className="mark" aria-hidden="true">◩</span> Taller de corte</div>
      <button type="button" onClick={reset}>Cargar repisa de ejemplo</button>
    </header>
    <main>
      <h1>Planificador de cortes</h1>
      <div className="workspace">
        <aside className="sidebar" aria-label="Medidas y piezas">
          <button className="edit-toggle" type="button" aria-expanded={editing} aria-controls="entradas" onClick={() => setEditing(!editing)}>
            {editing ? '− Ocultar medidas y piezas' : '+ Editar medidas y piezas'}
          </button>
        <form id="entradas" className={`inputs${editing ? ' is-editing' : ''}`} onSubmit={submit}>
          <fieldset><legend>Tableros</legend>
            <div className="fields">
              {stockField('width', 'Ancho (mm)')}
              {stockField('length', 'Largo (mm)')}
              {stockField('quantity', 'Cantidad', { min: 1, max: 100, step: 1 })}
              {stockField('kerf', 'Ancho de corte (mm)', { min: 0, max: 100 })}
            </div>
          </fieldset>
          <fieldset><legend>Piezas</legend>
            {pieces.map((piece, index) => <div className="piece" key={piece.id}>
              <div className="piece-title"><span className="swatch" style={{ background: pieceColor(piece.id) }} aria-hidden="true" />
                <input className="name" name={`nombre-${piece.id}`} aria-label={`Nombre de pieza ${index + 1}`} required pattern=".*\S.*" maxLength={60} placeholder="Nombre de la pieza" value={piece.name} onChange={event => editPiece(piece.id, { name: event.target.value })} />
                <button type="button" className="remove" aria-label={`Eliminar ${piece.name || `pieza ${index + 1}`}`} onClick={() => { setPieces(previous => previous.filter(item => item.id !== piece.id)); setDirty(true) }}>×</button>
              </div>
              <div className="fields piece-fields">
                <NumberField label="Ancho (mm)" value={piece.width} onChange={width => editPiece(piece.id, { width })} />
                <NumberField label="Largo (mm)" value={piece.length} onChange={length => editPiece(piece.id, { length })} />
                <NumberField label="Cantidad" min={1} max={500} step={1} value={piece.quantity} onChange={quantity => editPiece(piece.id, { quantity })} />
              </div>
              <label className="rotation"><input name={`giro-${piece.id}`} type="checkbox" checked={piece.rotate} onChange={event => editPiece(piece.id, { rotate: event.target.checked })} /> Permitir giro de 90°</label>
            </div>)}
            <button type="button" className="add" onClick={addPiece} disabled={pieces.length >= 100}>+ Agregar pieza</button>
          </fieldset>
          {error && <p className="alert" role="alert">{error}</p>}
          <button type="submit" className="primary">Calcular propuestas</button>
        </form>
        </aside>
        <section className="plans" aria-labelledby="plan-title">
          <div className="plan-heading">
            <div><h2 id="plan-title" tabIndex={-1} ref={planTitle}>Plano de corte</h2><p>Propuestas heurísticas · Corte de {format(usedStock.kerf)} mm</p></div>
            <button type="button" className="download" disabled={dirty} onClick={exportActivePlan}>↓ Descargar plano imprimible</button>
          </div>
          {exportError && <p className="notice" role="alert">{exportError}</p>}
          {dirty && <p className="notice" role="status">Hay cambios sin calcular. El plano muestra la última propuesta.</p>}
          <fieldset className="comparison"><legend>Comparar estrategias</legend>
            <div className="options">{strategies.map(({ id, label }) =>
              <label className="option" key={id}><input type="radio" name="estrategia" value={id} checked={id === strategy} onChange={() => chooseStrategy(id)} />{label}</label>
            )}</div>
          </fieldset>
          <dl className="metrics" aria-live="polite">
            {metrics.map(({ label, value, delta, unit }) => <div key={label}>
              <dt>{label}</dt><dd>{value}</dd><small>{delta === 0 ? 'Sin diferencia' : `${difference(delta)}${unit}`}</small>
            </div>)}
          </dl>
          <p className="compare-context">Diferencias frente a {strategies.find(item => item.id === alternative)!.label.toLowerCase()}. pp = puntos porcentuales.</p>
          {pending.size > 0 && <details className="notice pending">
            <summary><strong>Plan incompleto</strong> · {plan.unplaced.length} sin ubicar</summary>
            <ul>{[...pending].map(([id, { name, count }]) => <li key={id}>{count} × {name}</li>)}</ul>
          </details>}
          {board ? <article className="board">
            <header>
              {plan.boards.length > 1 ? <label className="board-select">Tablero <select value={boardIndex} onChange={event => { setBoardIndex(Number(event.target.value)); setSelected('') }}>
                {plan.boards.map((_, index) => <option key={index} value={index}>{index + 1} de {plan.boards.length}</option>)}
              </select></label> : <strong>Tablero 1</strong>}
              <span>{format(usedStock.width)} × {format(usedStock.length)} mm</span>
            </header>
            <div className="view-switch" role="group" aria-label="Visualización del tablero">
              <button type="button" aria-pressed={view === '2d'} onClick={() => setView('2d')}>Plano 2D</button>
              <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>Vista 3D</button>
            </div>
            <BoardViewport stock={usedStock} board={board} index={boardIndex} selected={selected} onSelect={setSelected} view={view} />
            <div className="key"><span className="key-piece">Pieza</span><span className="key-offcut">Sobrante</span><span className="key-cut">Ancho de corte</span></div>
            <div className="inspector">
              <label>Pieza del tablero <select value={selectedPiece ? selected : ''} onChange={event => setSelected(event.target.value)}>
                <option value="">Elegir pieza</option>
                {board.placements.map(item => <option key={placementKey(item)} value={placementKey(item)}>{item.piece.name} {item.copy}</option>)}
              </select></label>
              {selectedPiece && <p className="piece-data" role="status">
                <strong>{selectedPiece.piece.name} {selectedPiece.copy} · {format(selectedPiece.width)} × {format(selectedPiece.length)} mm</strong>
                <span>{selectedPiece.rotated ? 'Girada 90°' : 'Orientación original'}</span>
                <span>X {format(selectedPiece.x)} · Y {format(selectedPiece.y)} mm</span>
              </p>}
            </div>
          </article> : <p className="empty">No hay tableros usados en esta propuesta. Revisa las piezas sin ubicar y ajusta las medidas o el stock.</p>}
        </section>
      </div>
    </main>
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
