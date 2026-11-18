import type { Board, Piece, Placement, Rect, Stock } from './model'

type Unit = { piece: Piece; copy: number }
export type Strategy = 'area' | 'side'
export type Plan = { boards: Board[]; unplaced: Unit[]; placed: number; total: number; utilization: number }

const precision = 100
const scaled = (value: number) => Math.round(value * precision)
const area = ({ width, length }: { width: number; length: number }) => width * length
const unscale = <T extends Rect>(rect: T): T => ({
  ...rect, x: rect.x / precision, y: rect.y / precision,
  width: rect.width / precision, length: rect.length / precision,
})

function fits(remaining: number, kerf: number) {
  return remaining === 0 || (remaining > 0 && remaining >= kerf)
}

function findSlot(board: Board, piece: Piece, kerf: number) {
  const width = scaled(piece.width)
  const length = scaled(piece.length)
  const orientations = [{ width, length, rotated: false }]
  if (piece.rotate && width !== length) orientations.push({ width: length, length: width, rotated: true })

  let best: { index: number; width: number; length: number; rotated: boolean; waste: number; shortGap: number } | undefined
  for (const [index, rect] of board.offcuts.entries()) {
    for (const orientation of orientations) {
      const dx = rect.width - orientation.width
      const dy = rect.length - orientation.length
      if (!fits(dx, kerf) || !fits(dy, kerf)) continue
      const waste = area(rect) - width * length
      const shortGap = Math.min(dx, dy)
      if (!best || waste < best.waste || (waste === best.waste && shortGap < best.shortGap)) {
        best = { index, ...orientation, waste, shortGap }
      }
    }
  }
  return best
}

function split(board: Board, index: number, width: number, length: number, kerf: number): Rect {
  const [rect] = board.offcuts.splice(index, 1)
  const { x, y } = rect
  const dx = rect.width - width
  const dy = rect.length - length
  const rightWidth = Math.max(0, dx - kerf)
  const bottomLength = Math.max(0, dy - kerf)

  // Keep the larger of the two full-span remnants by choosing its cut first.
  const verticalFirst = rightWidth * rect.length >= bottomLength * rect.width
  const rightLength = verticalFirst ? rect.length : length
  const bottomWidth = verticalFirst ? width : rect.width
  const right = { x: x + width + kerf, y, width: rightWidth, length: rightLength }
  const bottom = { x, y: y + length + kerf, width: bottomWidth, length: bottomLength }
  const vertical = { x: x + width, y, width: kerf, length: rightLength }
  const horizontal = { x, y: y + length, width: bottomWidth, length: kerf }

  const cuts = verticalFirst ? [dx > 0 ? vertical : null, dy > 0 ? horizontal : null]
    : [dy > 0 ? horizontal : null, dx > 0 ? vertical : null]
  for (const cut of cuts) if (cut) board.cuts.push(cut)
  for (const offcut of [right, bottom]) if (area(offcut) > 0) board.offcuts.push(offcut)
  return { x, y, width, length }
}

export function calculate(stock: Stock, pieces: readonly Piece[], strategy: Strategy = 'area'): Plan {
  const largestSide = (piece: Piece) => Math.max(piece.width, piece.length)
  const priority = strategy === 'side' ? (piece: Piece) => scaled(largestSide(piece))
    : (piece: Piece) => scaled(piece.width) * scaled(piece.length)
  const order = [...pieces].sort((a, b) => priority(b) - priority(a) || a.id - b.id)
  const units = order.flatMap(piece => Array.from({ length: piece.quantity }, (_, index) => ({ piece, copy: index + 1 })))
  const width = scaled(stock.width)
  const length = scaled(stock.length)
  const kerf = scaled(stock.kerf)
  const boards: Board[] = []
  const unplaced: Unit[] = []
  let occupied = 0

  for (const unit of units) {
    let placed = false
    for (let i = 0; i <= boards.length && i < stock.quantity; i++) {
      const board = boards[i] ?? { placements: [], offcuts: [{ x: 0, y: 0, width, length }], cuts: [] }
      const slot = findSlot(board, unit.piece, kerf)
      if (!slot) continue
      const rect = split(board, slot.index, slot.width, slot.length, kerf)
      const placement: Placement = { ...rect, ...unit, rotated: slot.rotated }
      board.placements.push(placement)
      boards[i] = board
      occupied += area(placement)
      placed = true
      break
    }
    if (!placed) unplaced.push(unit)
  }

  return {
    boards: boards.map(board => ({
      placements: board.placements.map(unscale), offcuts: board.offcuts.map(unscale), cuts: board.cuts.map(unscale),
    })),
    placed: units.length - unplaced.length,
    total: units.length,
    unplaced,
    utilization: boards.length ? occupied / (width * length * boards.length) * 100 : 0,
  }
}
