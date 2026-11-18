import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode, Ref } from 'react'
import { EdgesGeometry, BoxGeometry, MathUtils, OrthographicCamera, Vector3 } from 'three'
import type { Group } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { format, pieceColor } from './BoardDrawing'
import { boardFootprint } from './boardSpace'
import { placementKey } from './model'
import type { Board, Stock } from './model'

const block = new BoxGeometry()
const outline = new EdgesGeometry(block)
const vertical = new Vector3(0, 1, 0)
const thickness = .026
const motionQuery = '(prefers-reduced-motion: reduce)'

function subscribeMotion(update: () => void) {
  const preference = matchMedia(motionQuery)
  preference.addEventListener('change', update)
  return () => preference.removeEventListener('change', update)
}

type CameraActions = { view: (top: boolean) => void; zoom: (factor: number) => void; rotate: (angle: number) => void }

function CameraControls({ actions, onLoss }: { actions: Ref<CameraActions>; onLoss: () => void }) {
  const { camera, gl, invalidate, size } = useThree()
  const control = useRef<OrbitControls>(null)
  const previousFit = useRef(0)
  const fit = Math.min(size.width / 1.47, size.height / 1.25)

  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement)
    control.current = orbit
    orbit.enablePan = false
    orbit.maxPolarAngle = Math.PI * .48
    const render = () => invalidate()
    orbit.addEventListener('change', render)
    gl.domElement.addEventListener('webglcontextlost', onLoss)
    return () => {
      orbit.removeEventListener('change', render)
      gl.domElement.removeEventListener('webglcontextlost', onLoss)
      orbit.dispose()
      control.current = null
    }
  }, [camera, gl, invalidate, onLoss])

  useEffect(() => {
    if (!(camera instanceof OrthographicCamera) || !fit) return
    const factor = previousFit.current ? camera.zoom / previousFit.current : 1
    previousFit.current = fit
    camera.zoom = fit * factor
    camera.updateProjectionMatrix()
    if (control.current) {
      control.current.minZoom = fit * .45
      control.current.maxZoom = fit * 4
    }
    invalidate()
  }, [camera, fit, invalidate])

  useImperativeHandle(actions, () => ({
    view(top) {
      if (top) camera.position.set(0, 2.4, .0001)
      else camera.position.set(...defaultCamera.position)
      if (camera instanceof OrthographicCamera) {
        camera.zoom = fit
        camera.updateProjectionMatrix()
      }
      control.current?.update()
      invalidate()
    },
    zoom(factor) {
      if (!(camera instanceof OrthographicCamera)) return
      camera.zoom = MathUtils.clamp(camera.zoom * factor, fit * .45, fit * 4)
      camera.updateProjectionMatrix()
      invalidate()
    },
    rotate(angle) {
      camera.position.applyAxisAngle(vertical, angle)
      control.current?.update()
      invalidate()
    },
  }), [camera, fit, invalidate])
  return null
}

function PlanSolids({ board, stock, selected, onSelect, separated, reducedMotion }: {
  board: Board; stock: Stock; selected: string; onSelect: (key: string) => void; separated: boolean; reducedMotion: boolean
}) {
  const pieces = useRef<Group>(null)
  const invalidate = useThree(state => state.invalidate)
  const base = boardFootprint({ x: 0, y: 0, width: stock.width, length: stock.length }, stock)

  const hatch = useMemo(() => {
    const vertices: number[] = []
    for (const rect of board.offcuts) {
      const area = boardFootprint(rect, stock)
      const left = area.x - area.width / 2
      const rear = area.z - area.length / 2
      for (let offset = .024; offset < area.width + area.length; offset += .03) {
        const start = Math.max(0, offset - area.length)
        const end = Math.min(area.width, offset)
        vertices.push(left + start, thickness + .0004, rear + offset - start,
          left + end, thickness + .0004, rear + offset - end)
      }
    }
    return new Float32Array(vertices)
  }, [board.offcuts, stock])

  useEffect(() => { invalidate() }, [invalidate, separated, reducedMotion, board])

  useFrame((_, delta) => {
    pieces.current?.children.forEach((item, index) => {
      const target = separated ? .085 + (index % 4) * .044 : 0
      item.position.y = reducedMotion || Math.abs(item.position.y - target) < .0005
        ? target : MathUtils.damp(item.position.y, target, 10, Math.min(delta, .05))
      if (item.position.y !== target) invalidate()
    })
  })

  return <>
    <mesh position={[0, -thickness / 2, 0]} scale={[base.width, thickness, base.length]} geometry={block}>
      <meshLambertMaterial color="#b6946d" />
    </mesh>
    {board.offcuts.map((rect, index) => {
      const area = boardFootprint(rect, stock)
      return <group key={index} position={[area.x, thickness / 2, area.z]} scale={[area.width, thickness, area.length]}>
        <mesh geometry={block}><meshLambertMaterial color="#e9dcc6" /></mesh>
        <lineSegments geometry={outline}><lineBasicMaterial color="#8e775b" /></lineSegments>
      </group>
    })}
    {hatch.length > 0 && <lineSegments>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[hatch, 3]} /></bufferGeometry>
      <lineBasicMaterial color="#a79378" transparent opacity={.5} />
    </lineSegments>}
    {board.cuts.map((rect, index) => {
      if (!rect.width || !rect.length) return null
      const area = boardFootprint(rect, stock)
      return <mesh key={index} position={[area.x, .0008, area.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[area.width, area.length]} />
        <meshBasicMaterial color="#5b4431" />
      </mesh>
    })}
    <group ref={pieces}>
      {board.placements.map(placement => {
        const area = boardFootprint(placement, stock)
        const key = placementKey(placement)
        const active = selected === key
        return <group key={key} position={[area.x, 0, area.z]}>
          <group position={[0, thickness / 2, 0]} scale={[area.width, thickness, area.length]}>
            <mesh geometry={block} onClick={event => {
              event.stopPropagation()
              if (event.delta <= 5) onSelect(key)
            }}>
              <meshLambertMaterial color={active ? '#bfdbad' : pieceColor(placement.piece.id)} />
            </mesh>
            <lineSegments geometry={outline}>
              <lineBasicMaterial color={active ? '#174638' : '#725339'} />
            </lineSegments>
          </group>
        </group>
      })}
    </group>
  </>
}

const defaultCamera = { position: [1.15, 1.55, 1.65] as [number, number, number], near: .01, far: 20 }

export default function BoardScene({ board, stock, index, selected, onSelect, fallback }: {
  board: Board; stock: Stock; index: number; selected: string; onSelect: (key: string) => void; fallback: ReactNode
}) {
  const [separated, setSeparated] = useState(false)
  const [failed, setFailed] = useState(false)
  const [supportsWebGL] = useState(() => {
    const context = document.createElement('canvas').getContext('webgl2')
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!context
  })
  const camera = useRef<CameraActions>(null)
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => matchMedia(motionQuery).matches)
  const onLoss = useRef(() => setFailed(true)).current

  if (failed || !supportsWebGL) return fallback

  return <div className="scene">
    <div className="scene-tools" role="group" aria-label="Controles de vista 3D">
      <button type="button" onClick={() => camera.current?.view(true)}>Vista superior</button>
      <button type="button" onClick={() => camera.current?.view(false)}>Perspectiva</button>
      <button type="button" aria-label="Girar cámara a la izquierda" onClick={() => camera.current?.rotate(-Math.PI / 8)}>↶</button>
      <button type="button" aria-label="Girar cámara a la derecha" onClick={() => camera.current?.rotate(Math.PI / 8)}>↷</button>
      <button type="button" aria-label="Acercar cámara" onClick={() => camera.current?.zoom(1.2)}>+</button>
      <button type="button" aria-label="Alejar cámara" onClick={() => camera.current?.zoom(1 / 1.2)}>−</button>
      <button type="button" className="separate" aria-pressed={separated} onClick={() => setSeparated(!separated)}>Separar piezas</button>
    </div>
    <div className="scene-canvas" role="img" aria-label={`Vista 3D del tablero ${index + 1}, ${format(stock.width)} por ${format(stock.length)} mm`}>
      <Canvas orthographic camera={defaultCamera} frameloop="demand" dpr={[1, 1.65]} flat fallback={fallback}>
        <color attach="background" args={['#f8f2e7']} />
        <ambientLight intensity={1.15} />
        <directionalLight position={[-2, 4, -3]} intensity={1.9} />
        <gridHelper args={[6, 72, '#dfd2bf', '#e9ddcc']} position={[0, -.055, 0]} />
        <CameraControls actions={camera} onLoss={onLoss} />
        <PlanSolids board={board} stock={stock} selected={selected} onSelect={onSelect} separated={separated} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
    <p className="scene-hint">Arrastra para girar · Rueda o pellizco para acercar · Grosor ilustrativo</p>
  </div>
}
