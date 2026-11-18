import { format } from './BoardDrawing'
import type { Plan, Strategy } from './engine'
import type { Piece, Stock } from './model'

export function downloadPlan(strategy: Strategy, label: string, stock: Stock, pieces: Piece[], plan: Plan, drawings: HTMLElement) {
  const printable = document.implementation.createHTMLDocument('Plano de corte')
  printable.documentElement.lang = 'es-CL'
  const meta = printable.createElement('meta')
  meta.setAttribute('charset', 'utf-8')
  printable.head.prepend(meta)
  const style = printable.createElement('style')
  style.textContent = `
    @page { size: A4; margin: 14mm; }
    body { color: #14252d; font: 15px system-ui, sans-serif; margin: 24px auto; padding: 0 12px; max-width: 850px; }
    article { break-inside: avoid; margin: 20px 0; }
    article header { display: flex; gap: 1em; margin-bottom: .5em; }
    .drawing { display: block; width: 100%; max-height: 150mm; background: #1c303a; font-family: monospace; print-color-adjust: exact; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; border-bottom: 1px solid #9aabb3; padding: .35em; overflow-wrap: anywhere; }
    tr { break-inside: avoid; }
    @media print { body { margin: 0; padding: 0; } .print { display: none; } }
  `
  printable.head.append(style)

  function add(tag: string, content: string, parent: HTMLElement = printable.body) {
    const element = printable.createElement(tag)
    element.textContent = content
    parent.append(element)
    return element
  }

  add('h1', 'Plano de corte')
  add('p', 'Para imprimir o guardar como PDF, abre el menú de impresión del navegador.').className = 'print'
  add('h2', label)
  add('p', `Propuesta heurística · Tableros de ${format(stock.width)} × ${format(stock.length)} mm · Ancho de corte ${format(stock.kerf)} mm`)
  add('p', `${plan.placed}/${plan.total} piezas ubicadas · ${plan.boards.length}/${stock.quantity} tableros usados · ${format(plan.utilization)} % de aprovechamiento`)
  if (plan.unplaced.length) add('p', `Plan incompleto · ${plan.unplaced.length} piezas sin ubicar`)

  add('h2', 'Lista de piezas')
  const remaining = new Map<number, number>()
  for (const { piece } of plan.unplaced) remaining.set(piece.id, (remaining.get(piece.id) ?? 0) + 1)
  const table = printable.createElement('table')
  const heading = table.createTHead().insertRow()
  for (const name of ['Pieza', 'Ancho × largo (mm)', 'Cantidad', 'Giro permitido', 'Sin ubicar']) {
    (add('th', name, heading) as HTMLTableCellElement).scope = 'col'
  }
  const rows = table.createTBody()
  for (const piece of pieces) {
    const row = rows.insertRow()
    for (const value of [piece.name, `${format(piece.width)} × ${format(piece.length)}`, piece.quantity, piece.rotate ? 'Sí' : 'No', remaining.get(piece.id) ?? 0]) {
      row.insertCell().textContent = String(value)
    }
  }
  printable.body.append(table)

  for (const board of drawings.querySelectorAll('article')) {
    const copy = printable.importNode(board, true)
    const details = copy.querySelector('details')
    if (details) details.open = true
    printable.body.append(copy)
  }

  const blob = new Blob(['<!doctype html>\n', printable.documentElement.outerHTML], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `plano-${strategy === 'area' ? 'area' : 'lado-mayor'}.html`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

