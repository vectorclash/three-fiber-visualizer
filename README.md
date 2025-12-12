# Audio-Reactive Kaleidoscope Visualizer

An immersive 3D audio visualizer built with React Three Fiber that responds to your microphone input in real-time. Features nested wireframe cubes, kaleidoscope effects, and smooth audio-reactive animations.

## Features

- **Audio-Reactive Animation**: Real-time visualization responds to microphone input
- **20 Nested Cubes**: Wireframe cubes with only edge lines (no face diagonals)
- **Rainbow Color Shift**: Each cube displays a different hue across the spectrum
- **Frequency-Based Reactivity**: Different cubes react to different frequency bands
- **Smooth Motion**: Oscillating rotation with audio-reactive period (60s base, speeds up with audio)
- **Kaleidoscope Effect**: 12-segment mirror effect with proper aspect ratio correction
- **Bloom Post-Processing**: Adds glow to the metallic materials
- **Audio-Reactive Background**: Radial gradient that pulses with music

## Technology Stack

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **Three.js 0.181** - 3D graphics library
- **React Three Fiber 9** - React renderer for Three.js
- **React Three Drei 10** - Useful helpers for R3F
- **React Three Postprocessing 3** - Post-processing effects
- **Web Audio API** - Microphone input and frequency analysis

## Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)
- A modern web browser with microphone access

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd three-fiber-visualizer

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Running the App

1. Open your browser to the URL shown in the terminal (typically `http://localhost:5173`)
2. Allow microphone access when prompted
3. Make some noise and watch the visualization react!

## How It Works

### Audio Processing

The visualizer uses the Web Audio API to capture microphone input and analyze it in real-time:

- **FFT Size**: 128 (fast response)
- **Smoothing**: 0.6 (balanced smoothness)
- **Exponential Boost**: Power of 0.6 for sensitivity to quieter sounds

### Visual Elements

**Wireframe Cubes**
- Built from cylinder geometry to create thick, metallic edges
- Only the 12 edge lines of each cube are rendered (no face diagonals)
- Scale and thickness react to different frequency bands
- Each cube reacts to a different portion of the audio spectrum

**Rotation System**
- Base oscillation: Slow sine wave over 60 seconds
- Audio boost: Additional forward rotation when audio is active
- Phase offset: Each cube is slightly out of sync for wave patterns

**Post-Processing**
- Bloom effect adds glow to bright metallic surfaces
- Kaleidoscope creates 12-way mirror symmetry
- Effects are properly chained: Bloom → Kaleidoscope

## Customization

### Adjusting Audio Sensitivity

In [src/App.jsx:27](src/App.jsx#L27):
```javascript
analyzer.smoothingTimeConstant = 0.6 // Lower = more responsive, higher = smoother
```

In [src/App.jsx:46](src/App.jsx#L46):
```javascript
const boosted = Math.pow(normalized, 0.6) // Lower power = more sensitivity
```

### Changing Visual Parameters

**Number of cubes** ([src/App.jsx:72](src/App.jsx#L72)):
```javascript
const cubeCount = 20 // Change to add/remove cubes
```

**Scale reactivity** ([src/App.jsx:173](src/App.jsx#L173)):
```javascript
const targetScale = 1 + (frequency * 0.6) // Increase multiplier for more dramatic scaling
```

**Edge thickness** ([src/App.jsx:175-176](src/App.jsx#L175-L176)):
```javascript
const baseRadius = 0.015  // Minimum thickness
const maxRadius = 0.06    // Maximum thickness when audio peaks
```

**Kaleidoscope segments** ([src/App.jsx:161](src/App.jsx#L161)):
```javascript
<Kaleidoscope segments={12} /> // Change for more/fewer mirror segments
```

**Bloom intensity** ([src/App.jsx:156](src/App.jsx#L156)):
```javascript
<Bloom intensity={0.5} /> // Increase for more glow
```

## Project Structure

```
three-fiber-visualizer/
├── src/
│   ├── App.jsx           # Main application with all components
│   ├── main.jsx          # React entry point
│   └── index.css         # Basic styles
├── public/               # Static assets
├── index.html           # HTML entry point
├── vite.config.js       # Vite configuration
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## Performance Notes

- The visualizer renders 20 cubes × 12 edges = 240 mesh objects
- Each mesh updates its geometry dynamically based on audio
- Post-processing effects add additional GPU load
- Recommended: Modern GPU for smooth 60fps performance

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Requires HTTPS for microphone access
- Mobile: Limited performance, microphone access varies

## License

MIT

## Acknowledgments

Built with React Three Fiber and the amazing Three.js ecosystem.
