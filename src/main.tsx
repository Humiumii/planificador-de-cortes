import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { BoardDrawing, format, pieceColor } from './BoardDrawing'
import { examplePieces, exampleStock } from './model'
import type { Piece, Stock } from './model'
import { calculate } from './engine'
import './style.css'

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
  const [result, setResult] = useState(() => ({ stock: exampleStock, plan: calculate(exampleStock, examplePieces) }))
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
    setStock(exampleStock)
    setPieces(examplePieces)
    setNextId(4)
    setResult({ stock: exampleStock, plan: calculate(exampleStock, examplePieces) })
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
    setResult({ stock, plan: calculate(stock, pieces) })
    setDirty(false)
  }

  const stockField = (field: keyof Stock, label: string, options?: { min?: number; max?: number; step?: number }) =>
    <NumberField label={label} value={stock[field]} onChange={value => editStock(field, value)} {...options} />

  const { plan, stock: usedStock } = result
  const pending = new Map<number, { name: string; count: number }>()
  for (const { piece } of plan.unplaced) {
    const previous = pending.get(piece.id)
    pending.set(piece.id, { name: piece.name, count: (previous?.count ?? 0) + 1 })
  }

  return <>
    <header className="topbar"><div className="brand"><span className="mark" aria-hidden="true">◩</span> Taller de corte</div><button type="button" className="reset" onClick={reset}>Cargar repisa de ejemplo</button></header>
    <main>
      <div className="intro"><h1>Planificador de cortes</h1><p>Distribuye las piezas de tu mueble y compara el aprovechamiento de los tableros.</p></div>
      <div className="workspace">
        <form className="inputs" onSubmit={submit}>
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
          <button type="submit" className="primary">Calcular distribución</button>
        </form>
        <section className="plans" aria-label="Plano de corte">
          <div className="plan-heading"><div><h2>Plano de corte</h2><p>Propuesta heurística por área descendente</p></div></div>
          {dirty && <p className="alert" role="status">Hay cambios sin calcular. El plano muestra el último cálculo.</p>}
          <div className="metrics" aria-live="polite">
            <div><strong>{plan.placed}/{plan.total}</strong><span>Piezas ubicadas</span></div>
            <div><strong>{plan.boards.length}/{usedStock.quantity}</strong><span>Tableros usados</span></div>
            <div><strong>{format(plan.utilization)} %</strong><span>Aprovechamiento</span></div>
          </div>
          {pending.size > 0 && <div className="alert" role="status"><strong>Plan incompleto</strong><p>Sin ubicar: {[...pending.values()].map(({ name, count }) => `${count} × ${name}`).join(', ')}.</p></div>}
          {plan.boards.map((board, index) => <article className="board" key={index}>
            <header><strong>Tablero {index + 1}</strong><span>{format(usedStock.width)} × {format(usedStock.length)} mm</span></header>
            <BoardDrawing stock={usedStock} board={board} index={index} />
          </article>)}
        </section>
      </div>
    </main>
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
