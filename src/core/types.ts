export type FormatId = 'portrait' | 'square' | 'landscape' | 'a4'
export type Category = 'discreta' | 'composta' | 'autoral'
export interface Size {
  width: number
  height: number
}
export interface Rect extends Size {
  x: number
  y: number
}
export type Matrix = readonly [number, number, number, number, number, number]
export interface Crop {
  centerX: number
  centerY: number
  zoom: number
}
export interface Appearance {
  paperColor: string
  margin: number
  corner: number
  border: boolean
  caption: string
  date: string
  font: 'serif' | 'sans'
}
export interface ModelCapabilities {
  paper: boolean
  margin: { editable: boolean; max: number }
  corners: { editable: boolean; max: number; choices: readonly number[] }
  border: boolean
  text: { caption: boolean; date: boolean }
}
export interface FrameDefinition extends Rect {
  id: string
  rotation: number
  mask: 'rect' | 'arch'
  tape: boolean
  paperBorder: boolean
  shadow: boolean
}
export interface ModelVariant {
  frames: readonly FrameDefinition[]
  background?: (size: Size, appearance: Appearance) => readonly GraphicNode[]
}
export interface ModelDefinition {
  id: string
  name: string
  category: Category
  description: string
  frameOrder: readonly string[]
  capabilities: ModelCapabilities
  variants: Readonly<Record<FormatId, ModelVariant>>
}
export type Shape =
  | { kind: 'roundRect'; rect: Rect; radius: number }
  | { kind: 'arch'; rect: Rect }
  | { kind: 'ellipse'; x: number; y: number; rx: number; ry: number }
  | { kind: 'path'; points: readonly (readonly [number, number])[] }
interface NodeBase {
  id: string
  transform?: Matrix
}
export interface ShapeNode extends NodeBase {
  kind: 'shape'
  shape: Shape
  fill?: string
  stroke?: { color: string; width: number }
  shadow?: { color: string; blur: number; offsetY: number }
}
export interface TextNode extends NodeBase {
  kind: 'text'
  text: string
  x: number
  y: number
  size: number
  font: 'Georgia' | 'Arial'
  italic?: boolean
  color: string
  align: 'left' | 'center'
  baseline: 'middle' | 'alphabetic'
  maxWidth?: number
  minScale?: number
}
export type GraphicNode = ShapeNode | TextNode
export interface PhotoNode extends NodeBase {
  kind: 'photo'
  photoId: string | null
  source: Rect | null
  destination: Rect
  mask: Shape
  emptyLabel: string | null
  emptyFontSize: number
}
export type SceneNode = GraphicNode | PhotoNode
export interface FrameGeometry extends FrameDefinition {
  index: number
  placementId: string
  transform: Matrix
  radius: number
}
export interface ResolvedGeometry {
  size: Size
  formatId: FormatId
  modelId: string
  appearance: Appearance
  frames: readonly FrameGeometry[]
}
export interface PhotoMetadata extends Size {
  id: string
}
export interface Scene {
  size: Size
  modelId: string
  formatId: FormatId
  nodes: readonly SceneNode[]
  frames: readonly FrameGeometry[]
}
