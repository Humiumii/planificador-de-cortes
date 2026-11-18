export type Rect = { x: number; y: number; width: number; length: number }
export type Piece = { id: number; name: string; width: number; length: number; quantity: number; rotate: boolean }
export type Stock = { width: number; length: number; quantity: number; kerf: number }
export type Placement = Rect & { piece: Piece; copy: number; rotated: boolean }
export type Board = { placements: Placement[]; offcuts: Rect[]; cuts: Rect[] }

export const exampleStock: Stock = { width: 1600, length: 1200, quantity: 2, kerf: 3.2 }
export const examplePieces: Piece[] = [
  { id: 1, name: 'Lateral', width: 300, length: 1100, quantity: 2, rotate: false },
  { id: 2, name: 'Estante', width: 560, length: 280, quantity: 3, rotate: true },
  { id: 3, name: 'Travesaño', width: 600, length: 100, quantity: 1, rotate: true },
]
