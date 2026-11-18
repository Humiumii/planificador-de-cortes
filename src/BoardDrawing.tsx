import { useId } from 'react'
import type { Board, Stock } from './model'

export const palette = ['#ebbf6a', '#8fc1af', '#aeb8df', '#e7a591', '#b2c98b', '#dbc0de']
export const pieceColor = (id: number) => palette[(id - 1) % palette.length]
export const format = (value: number) => value.toLocaleString('es-CL', { maximumFractionDigits: 2, useGrouping: false })

export function BoardDrawing({ stock, board, index }: { stock: Stock; board: Board; index: number }) {
  const pattern = useId()
  const { width, length } = stock
  const unit = Math.max(width, length) / 640
  const pad = unit * 55
  const offset = unit * 20
  return <svg className="drawing" viewBox={`-${pad} -${pad} ${width + pad * 1.2} ${length + pad * 1.2}`} role="img" aria-label={`Plano del tablero ${index + 1}, ${format(width)} por ${format(length)} mm`}>
    <defs>
      <pattern id={pattern} width={unit * 7} height={unit * 7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={unit * 7} height={unit * 7} fill="#1c303a" />
        <path d={`M 0 0 V ${unit * 7}`} stroke="#38505b" strokeWidth={unit * 1.5} />
      </pattern>
    </defs>
    <g stroke="#b1c0c5" strokeWidth={unit * .8} fill="none">
      <path d={`M 0 -${offset * 1.4} V -${offset * .6} M 0 -${offset} H ${width} M ${width} -${offset * 1.4} V -${offset * .6}`} />
      <path d={`M -${offset * 1.4} 0 H -${offset * .6} M -${offset} 0 V ${length} M -${offset * 1.4} ${length} H -${offset * .6}`} />
    </g>
    <g fill="#d9e3e5" fontSize={unit * 13} textAnchor="middle">
      <text x={width / 2} y={-offset * 1.45}>{format(width)} mm</text>
      <text transform={`translate(${-offset * 1.5},${length / 2}) rotate(-90)`}>{format(length)} mm</text>
    </g>
    <rect width={width} height={length} fill={`url(#${pattern})`} stroke="#a2b6bf" strokeWidth={unit} />
    {board.cuts.map((cut, i) => <rect key={i} x={cut.x} y={cut.y} width={cut.width} height={cut.length} fill="#0e1920" />)}
    {board.placements.map(({ piece, x, y, width, length, rotated, copy }) => {
      const label = `${piece.name} ${copy}`
      const size = `${format(width)} × ${format(length)}${rotated ? ' ↻' : ''}`
      const verticalLabel = length > width * 2.5
      const textWidth = verticalLabel ? length : width
      const textHeight = verticalLabel ? width : length
      const font = Math.min(unit * 15, textWidth / (Math.max(label.length, size.length) * .66 + 1), textHeight / 3.3)
      const labelTransform = `translate(${x + width / 2},${y + length / 2})${verticalLabel ? ' rotate(-90)' : ''}`
      return <g key={`${piece.id}-${copy}`}>
        <title>{label} · {size} mm</title>
        <rect x={x} y={y} width={width} height={length} fill={pieceColor(piece.id)} stroke="#0e1920" strokeWidth={unit * .65} />
        {font >= unit * 5 && <text transform={labelTransform} y={-font * .17} fontSize={font} fill="#14252d" textAnchor="middle">
          <tspan fontWeight="700">{label}</tspan>
          <tspan x={0} dy={font * 1.25}>{size}</tspan>
        </text>}
      </g>
    })}
  </svg>
}
