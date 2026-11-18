import test from 'node:test'
import assert from 'node:assert/strict'
import { calculate } from '../src/engine.ts'
import { examplePieces, exampleStock } from '../src/model.ts'
import type { Piece, Rect, Stock } from '../src/model.ts'

const board: Stock = { width: 100, length: 100, quantity: 1, kerf: 3.2 }
const piece = (width: number, length: number, extra: Partial<Piece> = {}): Piece =>
  ({ id: 1, name: 'Pieza', width, length, quantity: 1, rotate: false, ...extra })

test('encaje exacto sin pasar la sierra', () => {
  const plan = calculate(board, [piece(100, 100)])
  assert.equal(plan.placed, 1)
  assert.equal(plan.utilization, 100)
  assert.deepEqual(plan.boards[0].cuts, [])
})

test('solo cabe girada cuando se autoriza', () => {
  const stock = { ...board, width: 60 }
  assert.equal(calculate(stock, [piece(90, 50)]).placed, 0)
  const plan = calculate(stock, [piece(90, 50, { rotate: true })])
  assert.equal(plan.boards[0].placements[0].rotated, true)
  assert.equal(plan.boards[0].placements[0].width, 50)
})

test('registra una pieza imposible sin gastar un tablero', () => {
  const item = piece(101, 100, { rotate: true })
  const plan = calculate(board, [item])
  assert.deepEqual(plan.unplaced, [{ piece: item, copy: 1 }])
  assert.equal(plan.boards.length, 0)
  assert.equal(plan.utilization, 0)
})

test('el ancho de corte cambia el resultado y respeta el límite de tableros', () => {
  const items = [piece(50, 100, { quantity: 2 })]
  assert.equal(calculate({ ...board, kerf: 0 }, items).placed, 2)
  assert.equal(calculate(board, items).placed, 1)
  assert.equal(calculate({ ...board, quantity: 2 }, items).placed, 2)
  assert.equal(calculate(board, [piece(48.4, 100, { quantity: 2 })]).placed, 2)
  assert.equal(calculate(board, [piece(98, 100)]).placed, 0)
})

function overlaps(a: Rect, b: Rect) {
  const tolerance = 1e-8
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > tolerance
    && Math.min(a.y + a.length, b.y + b.length) - Math.max(a.y, b.y) > tolerance
}

test('las piezas, cortes y sobrantes particionan el tablero sin salir ni superponerse', () => {
  const plan = calculate(exampleStock, examplePieces)
  assert.equal(plan.placed, 6)
  assert.deepEqual(plan, calculate(exampleStock, examplePieces))
  for (const board of plan.boards) {
    const rects = [...board.placements, ...board.cuts, ...board.offcuts]
    for (const [i, rect] of rects.entries()) {
      assert.ok(rect.x >= 0 && rect.y >= 0)
      assert.ok(rect.x + rect.width <= exampleStock.width + 1e-8)
      assert.ok(rect.y + rect.length <= exampleStock.length + 1e-8)
      assert.ok(!rects.slice(i + 1).some(other => overlaps(rect, other)))
    }
    const sum = rects.reduce((total, rect) => total + rect.width * rect.length, 0)
    assert.ok(Math.abs(sum - exampleStock.width * exampleStock.length) < 1e-7)
  }
})

