import type { Appearance, GraphicNode, Size, ShapeNode, TextNode } from '../types'

const line = (
  id: string,
  points: readonly (readonly [number, number])[],
  color: string,
  width: number,
): ShapeNode => ({ id, kind: 'shape', shape: { kind: 'path', points }, stroke: { color, width } })

export function film(bands: readonly (readonly [number, number])[]) {
  return ({ width: w, height: h }: Size, appearance: Appearance): readonly GraphicNode[] => {
    const nodes: GraphicNode[] = []
    bands.forEach(([top, height], row) => {
      const x = w * 0.055,
        y = h * top,
        bw = w * 0.89,
        bh = h * height
      nodes.push({
        id: `film-${row}`,
        kind: 'shape',
        shape: { kind: 'roundRect', rect: { x, y, width: bw, height: bh }, radius: 0 },
        fill: '#343039',
      })
      for (let i = 0; i < 25; i++)
        for (const [edge, py] of [
          ['top', y + h * 0.009],
          ['bottom', y + bh - h * 0.018],
        ] as const) {
          nodes.push({
            id: `film-${row}-${edge}-${i}`,
            kind: 'shape',
            shape: {
              kind: 'roundRect',
              rect: {
                x: x + w * 0.013 + i * w * 0.035,
                y: py,
                width: w * 0.013,
                height: h * 0.009,
              },
              radius: 0,
            },
            fill: appearance.paperColor,
          })
        }
      for (let i = 0; i < 3; i++) {
        const text: TextNode = {
          id: `film-number-${row}-${i}`,
          kind: 'text',
          text: String(row * 3 + i + 1).padStart(2, '0'),
          x: w * (0.1 + i * 0.283),
          y: y + bh - h * 0.028,
          size: w * 0.012,
          font: 'Arial',
          color: '#d3c7a4',
          align: 'left',
          baseline: 'alphabetic',
        }
        nodes.push(text)
      }
    })
    return nodes
  }
}

export function arches({ width: w, height: h }: Size): readonly GraphicNode[] {
  return [
    line(
      'arches-line',
      [
        [w * 0.08, h * 0.8],
        [w * 0.92, h * 0.8],
      ],
      '#c2abbc',
      w * 0.001,
    ),
    {
      id: 'arches-dot',
      kind: 'shape',
      shape: { kind: 'ellipse', x: w * 0.5, y: h * 0.763, rx: w * 0.006, ry: w * 0.006 },
      fill: '#ab8b74',
    },
  ]
}

export function correspondence({ width: w, height: h }: Size): readonly GraphicNode[] {
  return [
    line(
      'letters-address-1',
      [
        [w * 0.09, h * 0.09],
        [w * 0.23, h * 0.09],
      ],
      '#b59e8d',
      w * 0.0014,
    ),
    line(
      'letters-address-2',
      [
        [w * 0.09, h * 0.104],
        [w * 0.18, h * 0.104],
      ],
      '#b59e8d',
      w * 0.0014,
    ),
    ...[0.039, 0.031].map(
      (rx, i): ShapeNode => ({
        id: `letters-stamp-${i}`,
        kind: 'shape',
        shape: {
          kind: 'ellipse',
          x: w * 0.855,
          y: h * 0.085,
          rx: w * rx,
          ry: h * (i ? 0.025 : 0.032),
        },
        stroke: { color: '#b59e8d', width: w * 0.0014 },
      }),
    ),
    line(
      'letters-line',
      [
        [w * 0.1, h * 0.835],
        [w * 0.9, h * 0.835],
      ],
      '#b59e8d',
      w * 0.0014,
    ),
  ]
}
