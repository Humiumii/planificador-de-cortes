import test from 'node:test'
import assert from 'node:assert/strict'
import { boardFootprint } from '../src/boardSpace.ts'
import { calculate } from '../src/engine.ts'
import { examplePieces, exampleStock } from '../src/model.ts'

test('la huella 3D conserva cotas y coordenadas de la pieza girada del plano', () => {
  const plan = calculate(exampleStock, examplePieces, 'side')
  const rotated = plan.boards[0].placements.find(piece => piece.rotated)!
  assert.ok(rotated)
  const { x, z, width, length } = boardFootprint(rotated, exampleStock)
  const span = Math.max(exampleStock.width, exampleStock.length)
  assert.equal(width * span, rotated.width)
  assert.equal(length * span, rotated.length)
  assert.ok(Math.abs(x * span + (exampleStock.width - rotated.width) / 2 - rotated.x) < 1e-9)
  assert.ok(Math.abs(z * span + (exampleStock.length - rotated.length) / 2 - rotated.y) < 1e-9)
  assert.equal(rotated.width, rotated.piece.length)
  assert.equal(rotated.length, rotated.piece.width)
})

test('un tablero alto conserva su relación de aspecto y queda centrado', () => {
  const stock = { width: 400, length: 1200, quantity: 2, kerf: 3.2 }
  assert.deepEqual(boardFootprint({ x: 0, y: 0, width: 400, length: 1200 }, stock),
    { x: 0, z: 0, width: 1 / 3, length: 1 })
})
