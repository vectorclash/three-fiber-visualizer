import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo, forwardRef, useState, useEffect } from 'react'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { Effect } from 'postprocessing'
import { Uniform } from 'three'
import * as THREE from 'three'

// Audio analyzer hook
function useAudioAnalyzer() {
  const [audioData, setAudioData] = useState(new Uint8Array(0))
  const [audioLevel, setAudioLevel] = useState(0)
  const audioContextRef = useRef(null)
  const analyzerRef = useRef(null)
  const dataArrayRef = useRef(null)
  const animationIdRef = useRef(null)

  useEffect(() => {
    const setupAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const analyzer = audioContext.createAnalyser()
        const source = audioContext.createMediaStreamSource(stream)

        // Smaller FFT size for faster response
        analyzer.fftSize = 128
        analyzer.smoothingTimeConstant = 0.6 // Moderate smoothing for less twitchy response
        const bufferLength = analyzer.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        source.connect(analyzer)

        audioContextRef.current = audioContext
        analyzerRef.current = analyzer
        dataArrayRef.current = dataArray

        const updateAudioData = () => {
          if (analyzerRef.current && dataArrayRef.current) {
            analyzerRef.current.getByteFrequencyData(dataArrayRef.current)
            setAudioData(new Uint8Array(dataArrayRef.current))

            // Calculate average audio level with higher sensitivity
            const average = dataArrayRef.current.reduce((a, b) => a + b, 0) / dataArrayRef.current.length
            // Apply exponential scaling for more sensitivity to quieter sounds
            const normalized = average / 255
            const boosted = Math.pow(normalized, 0.6) // Power < 1 boosts lower values more
            setAudioLevel(boosted)
          }
          animationIdRef.current = requestAnimationFrame(updateAudioData)
        }

        updateAudioData()
      } catch (error) {
        console.error('Error accessing microphone:', error)
      }
    }

    setupAudio()

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  return { audioData, audioLevel }
}

// Kaleidoscope shader effect
const kaleidoscopeFragmentShader = /* glsl */ `
  uniform float segments;
  uniform float aspect;

  void mainUv(inout vec2 uv) {
    vec2 center = vec2(0.5, 0.5);
    vec2 coord = uv - center;

    // Apply aspect ratio correction to maintain 1:1
    if (aspect > 1.0) {
      coord.x *= aspect;
    } else {
      coord.y /= aspect;
    }

    float radius = length(coord);
    float angle = atan(coord.y, coord.x);

    // Create kaleidoscope effect with proper mirroring
    float segmentAngle = 2.0 * 3.14159265359 / segments;

    // Wrap angle to single segment
    float wrappedAngle = mod(angle, segmentAngle * 2.0);

    // Mirror alternating segments to create reflection effect
    if (wrappedAngle > segmentAngle) {
      wrappedAngle = segmentAngle * 2.0 - wrappedAngle;
    }

    // Convert back to cartesian coordinates
    vec2 newCoord = vec2(cos(wrappedAngle), sin(wrappedAngle)) * radius;

    // Reverse aspect ratio correction
    if (aspect > 1.0) {
      newCoord.x /= aspect;
    } else {
      newCoord.y *= aspect;
    }

    uv = newCoord + center;
  }
`

class KaleidoscopeEffect extends Effect {
  constructor({ segments = 6, aspect = 1 } = {}) {
    super('KaleidoscopeEffect', kaleidoscopeFragmentShader, {
      uniforms: new Map([
        ['segments', new Uniform(segments)],
        ['aspect', new Uniform(aspect)]
      ])
    })
  }

  update(renderer, inputBuffer, deltaTime) {
    // Update aspect ratio uniform based on viewport
    const aspect = renderer.domElement.width / renderer.domElement.height
    this.uniforms.get('aspect').value = aspect
  }
}

const Kaleidoscope = forwardRef(({ segments = 6 }, ref) => {
  const effect = useMemo(() => new KaleidoscopeEffect({ segments }), [segments])
  return <primitive ref={ref} object={effect} />
})

function SingleCube({ size, hue, rotationSpeed, audioLevel, frequencyData, index }) {
  const groupRef = useRef()
  const [tubeRadius, setTubeRadius] = useState(0.02)
  const smoothedScaleRef = useRef(1)
  const smoothedRadiusRef = useRef(0.02)

  useFrame((state, delta) => {
    // Slow oscillation with audio-reactive period
    // Base period of 60 seconds, but speeds up with audio (down to 15 seconds at max audio)
    const time = state.clock.elapsedTime
    const basePeriod = 60
    const minPeriod = 15
    const audioPeriodReduction = audioLevel * (basePeriod - minPeriod)
    const oscillationPeriod = basePeriod - audioPeriodReduction

    const phase = (index / 20) * Math.PI * 2 // Phase shift for each cube
    const speedModulation = Math.sin((time / oscillationPeriod) * Math.PI * 2 + phase)

    // Apply audio reactivity only in the forward direction
    // Audio adds additional forward rotation, doesn't affect the oscillation
    const baseSpeed = rotationSpeed * speedModulation
    const audioBoostSpeed = audioLevel * rotationSpeed * 2 // Additional forward rotation from audio
    const effectiveSpeed = baseSpeed + audioBoostSpeed

    groupRef.current.rotation.x += delta * effectiveSpeed
    groupRef.current.rotation.y += delta * effectiveSpeed
    groupRef.current.rotation.z += delta * effectiveSpeed

    // Apply audio reactivity to scale and tube radius based on frequency data with smoothing
    if (frequencyData && frequencyData.length > 0) {
      const freqIndex = Math.floor((index / 20) * frequencyData.length)
      const frequency = frequencyData[freqIndex] / 255 // Normalize to 0-1

      // Target values - increased range for more dramatic reactivity
      const targetScale = 1 + (frequency * 0.6) // Increased from 0.3 to 0.6
      const baseRadius = 0.015
      const maxRadius = 0.06 // Increased from 0.04 to 0.06
      const targetRadius = baseRadius + (frequency * (maxRadius - baseRadius))

      // Smooth interpolation (lerp) - adjust 0.1 for more/less smoothness
      const smoothingFactor = 0.1
      smoothedScaleRef.current += (targetScale - smoothedScaleRef.current) * smoothingFactor
      smoothedRadiusRef.current += (targetRadius - smoothedRadiusRef.current) * smoothingFactor

      groupRef.current.scale.setScalar(smoothedScaleRef.current)
      setTubeRadius(smoothedRadiusRef.current)
    }
  })

  // Define the 12 edges of a cube
  const edges = useMemo(() => {
    const half = size / 2

    return [
      // Bottom face edges
      [[-half, -half, -half], [half, -half, -half]],
      [[half, -half, -half], [half, -half, half]],
      [[half, -half, half], [-half, -half, half]],
      [[-half, -half, half], [-half, -half, -half]],

      // Top face edges
      [[-half, half, -half], [half, half, -half]],
      [[half, half, -half], [half, half, half]],
      [[half, half, half], [-half, half, half]],
      [[-half, half, half], [-half, half, -half]],

      // Vertical edges
      [[-half, -half, -half], [-half, half, -half]],
      [[half, -half, -half], [half, half, -half]],
      [[half, -half, half], [half, half, half]],
      [[-half, -half, half], [-half, half, half]],
    ]
  }, [size])

  const color = useMemo(() => `hsl(${hue}, 100%, 50%)`, [hue])

  return (
    <group ref={groupRef}>
      {edges.map((edge, idx) => {
        const start = new THREE.Vector3(...edge[0])
        const end = new THREE.Vector3(...edge[1])
        const direction = end.clone().sub(start)
        const length = direction.length()
        const midpoint = start.clone().add(end).multiplyScalar(0.5)

        // Calculate rotation to align cylinder with edge
        const axis = new THREE.Vector3(0, 1, 0)
        const quaternion = new THREE.Quaternion()
        quaternion.setFromUnitVectors(axis, direction.normalize())

        return (
          <mesh key={idx} position={midpoint} quaternion={quaternion}>
            <cylinderGeometry args={[tubeRadius, tubeRadius, length, 8]} />
            <meshStandardMaterial
              color={color}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function RotatingCubes({ audioLevel, audioData }) {
  const cubeCount = 20
  const startSize = 0.1
  const sizeIncrement = 0.2
  const startHue = 0
  const hueIncrement = 360 / cubeCount
  const startRotationSpeed = 0.1
  const rotationSpeedIncrement = 0.01

  return (
    <>
      {Array.from({ length: cubeCount }).map((_, index) => (
        <SingleCube
          key={index}
          index={index}
          size={startSize + index * sizeIncrement}
          hue={startHue + index * hueIncrement}
          rotationSpeed={startRotationSpeed + index * rotationSpeedIncrement}
          audioLevel={audioLevel}
          frequencyData={audioData}
        />
      ))}
    </>
  )
}

function AudioReactiveBackground({ audioLevel }) {
  const meshRef = useRef()

  useFrame(() => {
    if (meshRef.current) {
      // Pulse the gradient scale with audio
      const scale = 1 + audioLevel * 0.5
      meshRef.current.scale.setScalar(scale)
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, -10]}>
      <planeGeometry args={[50, 50]} />
      <shaderMaterial
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          void main() {
            vec2 center = vec2(0.5, 0.5);
            float dist = distance(vUv, center);

            // Radial gradient from gray to light sky blue
            vec3 innerColor = vec3(0.827, 0.827, 0.827); // #d3d3d3
            vec3 outerColor = vec3(0.529, 0.808, 0.922); // light sky blue

            vec3 color = mix(innerColor, outerColor, smoothstep(0.0, 1.0, dist));
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  )
}

function Scene() {
  const { audioLevel, audioData } = useAudioAnalyzer()

  return (
    <>
      {/* Audio-reactive radial gradient background */}
      <AudioReactiveBackground audioLevel={audioLevel} />

      {/* Lighting setup for metallic materials */}
      <ambientLight intensity={3} />
      <directionalLight position={[10, 10, 5]} intensity={12} />
      <directionalLight position={[-10, -10, -5]} intensity={8} />
      <pointLight position={[0, 5, 5]} intensity={12} color="#ffffff" />
      <spotLight position={[0, 10, 0]} angle={0.3} penumbra={1} intensity={10} />

      <RotatingCubes audioLevel={audioLevel} audioData={audioData} />
      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Kaleidoscope segments={12} />
      </EffectComposer>
    </>
  )
}

function App() {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <Scene />
    </Canvas>
  )
}

export default App
