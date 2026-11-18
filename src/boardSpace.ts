import type { Rect, Stock } from './model'

export function boardFootprint(rect: Rect, stock: Stock) {
  const span = Math.max(stock.width, stock.length)
  return {
    x: (rect.x + rect.width / 2 - stock.width / 2) / span,
    z: (rect.y + rect.length / 2 - stock.length / 2) / span,
    width: rect.width / span,
    length: rect.length / span,
  }
}
