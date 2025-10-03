# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **telemedicine system** for medical pose analysis called "Examen Osteomuscular Virtual". The application now supports **remote medical examinations** where patients connect from home and doctors analyze their posture in real-time from their medical office. The system uses MediaPipe Pose Landmarker for real-time postural and joint analysis with streaming capabilities between patient and doctor.

## Architecture

### Core Components
- **Telemedicine Server** (`server.js`): Node.js server with Socket.io handling real-time communication between patients and doctors
- **Patient Interface** (`paciente.html` + `telemedicine-patient.js`): Patient-side application that captures pose data and streams to doctor
- **Doctor Interface** (`medico.html` + `telemedicine-doctor.js`): Doctor-side application that receives and visualizes patient data in real-time
- **Original Local App** (`index.html` + `pose-medical-analyzer.js`): Original standalone application still available
- **CSS Styling** (`styles.css`): Responsive medical application styling for all interfaces

### Technology Stack
- **Backend**: Node.js + Express + Socket.io for real-time streaming
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Communication**: WebSocket connections for real-time data streaming
- **MediaPipe Pose Landmarker**: Real-time pose detection (loaded via CDN from jsdelivr.net)
- **Web APIs**: Camera access via getUserMedia, Canvas for visualization
- **Design System**: Modern dark UI with Figtree font (Google Fonts), Whereby-inspired interface
- **Medical Focus**: Specialized for clinical postural and joint analysis with telemedicine capabilities

## Development Commands

### Telemedicine System (Recommended)
```bash
# Install dependencies
npm install

# Start telemedicine server
npm start

# Development with auto-reload
npm run dev

# Access the applications:
# - Doctor interface: http://localhost:3000/medico
# - Patient interface: http://localhost:3000/paciente
# - Original app: http://localhost:3000
```

### Original Static Application (Legacy)
```bash
# Serve the original application (Python)
python3 -m http.server 8000

# Alternative with Node.js
npx http-server -p 8000

# Access at http://localhost:8000
```

### Build Process
- **Telemedicine system**: Uses Node.js server with Socket.io (requires npm install)
- **Original application**: Static files served directly (no build process)

## Key Features and Medical Logic

### Telemedicine Features
- **Real-time Streaming**: Patient pose data streamed live to doctor at 15-30 FPS
- **Session Management**: Unique 6-character codes connect patient-doctor pairs
- **Remote Control**: Doctor can send instructions and commands to patient
- **Live Visualization**: Doctor sees patient's skeleton overlay in real-time with proper z-index layering
- **Patient Skeleton Display**: Patient sees their own pose analysis overlay on video feed
- **Instant Metrics**: Medical calculations updated continuously during examination
- **Digital Capture**: Doctor can capture key moments for detailed analysis
- **Medical Reports**: Automated generation of comprehensive examination reports
- **Audio Guidance**: Patients receive spoken instructions during examination
- **Guided Medical Sequences**: Step-by-step examination protocols for different assessment types

### Examination Types
- **Postural Evaluation**: Cervical alignment, pelvic tilt, lateral deviation
- **Range of Motion**: Dynamic joint movement analysis
- **Symmetry Analysis**: Bilateral comparison and balance assessment
- **Complete Examination**: Comprehensive evaluation combining all assessments
- **Remote Consultation**: Full telemedicine support for distance examinations

### Core Medical Calculations
- **Joint Angles**: 3-point angle calculations using vector mathematics
- **Postural Metrics**: Cervical alignment, pelvic tilt measurements
- **Symmetry Indices**: Bilateral comparison percentages
- **Real-time Analysis**: Continuous pose tracking and metric updates

### User Experience Enhancements
- **Automatic Camera Initialization**: Camera activates immediately upon page load
- **Visual Positioning Guides**: Green frame overlay helps patient positioning
- **Remote Control Operation**: Keyboard shortcuts eliminate need to approach computer
- **Countdown Timer**: 5-second countdown before exam starts, allowing time to position
- **Professional Workflow**: Designed for clinical environments with proper patient-practitioner distance

### Remote Control System
- **SPACE Key**: Starts examination with 5-second countdown
- **ESC Key**: Stops examination at any time
- **Button Alternatives**: Traditional click buttons remain available
- **Audio Guidance**: Speech synthesis for patient instructions

### Data Handling
- **Real-time Streaming**: Pose data streamed via WebSocket for live analysis
- **Session-based Storage**: Data exists only during active session
- **Client-side Processing**: MediaPipe analysis performed on patient's device
- **Server Relay**: Server only routes data between patient and doctor
- **Export Functionality**: JSON report generation for medical records
- **Privacy Compliant**: No persistent storage, data purged after session ends

## File Structure Patterns

```
/
├── server.js                      # Telemedicine server with Socket.io
├── package.json                   # Node.js dependencies and scripts
├── paciente.html                  # Patient interface for remote examination
├── telemedicine-patient.js        # Patient-side streaming and pose analysis
├── medico.html                    # Doctor interface for receiving data
├── telemedicine-doctor.js         # Doctor-side visualization and controls
├── index.html                     # Original local application (legacy)
├── pose-medical-analyzer.js       # Core medical analysis logic
├── styles.css                     # Application styling
├── CLAUDE.md                      # Development guidelines (this file)
├── README-TELEMEDICINA.md         # Telemedicine system documentation
└── README.md                      # Original documentation
```

## Medical Standards and Thresholds

The application uses specific medical thresholds defined in the code:
- Cervical Alignment: Normal 0-10°, Alert >15°
- Pelvic Tilt: Normal 0-5°, Alert >5°
- Lateral Deviation: Normal 0-20mm, Alert >30mm
- Shoulder Symmetry: Normal >90%, Alert <85%
- Overall Balance: Normal >80%

## Privacy and Security Considerations

### Telemedicine Security
- **HTTPS Required**: Camera access requires secure context (production)
- **Session-based**: Unique codes prevent unauthorized access
- **No Data Persistence**: All data purged when session ends
- **WebSocket Security**: Real-time encrypted communication
- **Medical Privacy**: HIPAA-conscious design with temporary data handling
- **Local Processing**: Sensitive analysis stays on patient device

### Original Application Security
- **No Server Communication**: All processing happens locally
- **No Persistent Storage**: Data only exists during session
- **Medical Privacy Compliant**: Designed for healthcare environments

## Application Workflow

### Telemedicine Examination Flow (Primary)
1. **Doctor Setup**: Doctor opens `/medico`, creates session, gets unique code (e.g., ABC123)
2. **Patient Connection**: Patient opens `/paciente`, enters code ABC123, connects to doctor
3. **Live Streaming**: Patient's pose data streams in real-time to doctor's screen
4. **Remote Examination**: Doctor sees live skeleton, metrics, sends instructions to patient
5. **Data Capture**: Doctor captures key moments for detailed analysis
6. **Report Generation**: Automated medical report with findings and recommendations

### Original Local Application Flow (Legacy)
1. **Page Load**: Camera initializes automatically with MediaPipe setup
2. **Camera Preview**: Live video feed with positioning guides (green frame)
3. **Patient Positioning**: Visual guides help patient position within frame
4. **Ready State**: System displays "Cámara lista - Presione ESPACIO"
5. **Remote Start**: Healthcare professional presses SPACE key from examination distance
6. **Countdown**: 5-second countdown with visual number display
7. **Automatic Analysis**: Pose detection and medical calculations begin
8. **Real-time Feedback**: Live metrics display during examination
9. **Remote Stop**: ESC key stops examination, or use stop button

### Key Classes and Functions

#### TelemedicineDoctor Class (`telemedicine-doctor.js`)
- `createSession()`: Generates unique session code for patient connection
- `handlePoseData()`: Processes real-time pose data from patient
- `drawPoseOnCanvas()`: Visualizes patient's skeleton on doctor's screen with proper canvas styling
- `setupCanvas()`: Configures 600x400px canvas with dark background for optimal skeleton visibility
- `sendCommand()`: Sends instructions/commands to patient
- `startGuidedSequence()`: Initiates medical examination sequences (posture, ranges, symmetry, complete)
- `captureSnapshot()`: Captures moment for detailed analysis
- `generateReport()`: Creates comprehensive medical report with recommendations
- `generateRecommendations()`: Advanced medical recommendations based on clinical thresholds

#### TelemedicinePatient Class (`telemedicine-patient.js`)
- `connectToDoctor()`: Establishes connection using session code
- `transmitPoseData()`: Streams pose data to doctor in real-time
- `drawPoseLandmarks()`: Displays skeleton overlay on patient's video with z-index: 10
- `handleDoctorCommand()`: Processes commands received from doctor
- `calculateMedicalMetrics()`: Computes medical measurements locally using original algorithms
- `startGuidedSequence()`: Processes guided examination instructions with audio feedback
- `speak()`: Text-to-speech for patient instructions in Spanish

#### MedicalPoseAnalyzer Class (`pose-medical-analyzer.js`) - Legacy
- `initializeCamera()`: Auto-activates camera on page load
- `showCameraPreview()`: Displays live feed with positioning guides
- `drawPositioningGuides()`: Renders visual frame for patient placement
- `startExamWithCountdown()`: Initiates examination with delay
- `showCountdown()`: 5-second countdown animation

## Design System

### UI/UX Design Philosophy
The application follows a **modern, professional dark theme** inspired by Whereby's clean interface design.

#### Color Palette
- **Background**: `#1c1e21` (main dark background)
- **Cards/Panels**: `#242527` (elevated surfaces)
- **Borders**: `#3a3b3c` (subtle separation)
- **Text Primary**: `#e4e6eb` (high contrast)
- **Text Secondary**: `#b0b3b8` (muted labels)
- **Accent Blue**: `#5b8def` (primary actions, links)
- **Success Green**: `#5ebd6d` (positive states)
- **Warning Yellow**: `#f7b928` (alerts, caution)
- **Error Red**: `#e85d55` (errors, critical)

#### Typography
- **Font Family**: Figtree (Google Fonts) - modern, professional, highly legible
- **Font Weights**: 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Base Size**: 14px for body text, 13px for labels, 18px for headings

#### Component Styling
- **Border Radius**: 12px for cards, 8px for inputs/buttons
- **Spacing**: 16px standard padding, 12px for compact elements
- **Transitions**: 0.2s ease for hover states
- **Shadows**: Minimal, using borders instead for depth

#### Doctor Interface Layout
- **Grid Layout**: 3-column (300px sidebar | 1fr video | 340px metrics)
- **Video Display**: Full-screen skeleton analysis with PiP patient video (240x135px) in bottom-left corner
- **Patient Video**: Picture-in-Picture style, dark border, subtle shadow

#### Patient Interface Layout
- **Split View**: 2-column grid for video feed and skeleton analysis side-by-side
- **Section Headers**: Colored titles (green for video, yellow for skeleton)
- **Connection Panel**: Centered, prominent session code input

### Design Principles
- **Dark First**: All interfaces use dark theme for reduced eye strain during long sessions
- **Minimal Gradients**: Flat colors for modern, professional appearance
- **Semantic Colors**: Green = success/active, Yellow = warning/attention, Red = error/critical, Blue = primary actions
- **Clear Hierarchy**: Typography weight and size create visual importance
- **Consistent Spacing**: 8px/12px/16px/24px rhythm throughout

## Development Guidelines

### Medical Application Context
- This is a **telemedicine diagnostic support tool**
- All changes must consider clinical accuracy and patient safety
- UI changes should maintain medical professional standards and dark theme consistency
- Code modifications should preserve medical calculation precision
- New features should enhance remote consultation workflow
- Telemedicine features must ensure reliable doctor-patient communication
- **Design updates must maintain Figtree font and Whereby-inspired dark aesthetic**

### Telemedicine Development Principles
- **Real-time Performance**: Maintain <200ms latency for live streaming
- **Connection Reliability**: Handle network interruptions gracefully
- **Data Accuracy**: Ensure pose data integrity during transmission
- **User Privacy**: No persistent storage of patient data
- **Session Security**: Validate session codes and prevent unauthorized access
- **Cross-device Compatibility**: Support various devices for both patients and doctors
- **Visual Reliability**: Proper z-index layering ensures skeleton visualization on both interfaces
- **Canvas Optimization**: 600x400px doctor canvas with dark background for medical analysis
- **UI Responsiveness**: Patient skeleton overlay with pointer-events: none for non-interference

### User Experience Principles
- **Immediate Connection**: Fast session establishment
- **Clear Instructions**: Visual and audio guidance for patients
- **Professional Interface**: Clean, medical-grade UI for doctors
- **Error Prevention**: Connection validation and error handling
- **Remote Efficiency**: Minimize setup time for examinations

### Browser Compatibility
- Requires modern browser with MediaPipe support
- WebRTC/getUserMedia capability essential for camera access
- WebSocket support for real-time communication
- Canvas and modern JavaScript features required
- Microphone access for audio instructions (optional)

## Recent Improvements (Latest)

### Modern UI Design Update (2025-10-03) - DESIGN OVERHAUL

**Complete visual redesign** of both doctor and patient interfaces with modern dark theme inspired by Whereby.

#### Changes Implemented:
1. **Typography**: Integrated Figtree font from Google Fonts across all interfaces
2. **Color System**: Implemented professional dark theme with semantic color palette
3. **Doctor Interface**:
   - 3-column grid layout (300px | 1fr | 340px)
   - Full-screen skeleton analysis canvas
   - Picture-in-Picture patient video (240x135px) in bottom-left corner
   - Dark panels (`#242527`) with subtle borders (`#3a3b3c`)
4. **Patient Interface**:
   - Split-view layout for video and skeleton side-by-side
   - Colored section headers (green for video, yellow for skeleton)
   - Modern connection panel with prominent session code input
5. **Component Updates**:
   - All buttons use flat design with semantic colors
   - Inputs/selects with dark backgrounds and blue focus states
   - Cards with 12px border radius, inputs with 8px
   - Consistent 16px padding throughout
6. **Status Indicators**: Color-coded backgrounds for connection states
7. **Base Styles**: Updated `styles.css` for consistency across original app

#### Files Modified:
- `medico.html`: Complete inline style overhaul
- `paciente.html`: Complete inline style overhaul
- `styles.css`: Base styles updated to dark theme
- `CLAUDE.md`: Added Design System section

#### Design Tokens:
- Background: `#1c1e21`
- Cards: `#242527`
- Borders: `#3a3b3c`
- Text: `#e4e6eb` (primary), `#b0b3b8` (secondary)
- Accent: `#5b8def` (blue), `#5ebd6d` (green), `#f7b928` (yellow), `#e85d55` (red)

### Complete System Fixes (2025-09-30) - CRITICAL UPDATES

#### 1. ES6 Module Loading for MediaPipe (CRITICAL FIX)
**Problem**: MediaPipe was not loading in any interface due to missing `type="module"` attribute
**Impact**: No pose detection, no skeleton visualization, complete system failure
**Solution**: Added `type="module"` to script tags in:
- `index.html`: `<script type="module" src="pose-medical-analyzer.js">`
- `paciente.html`: `<script type="module" src="telemedicine-patient.js">`

**Why this matters**: All three JavaScript files use ES6 dynamic imports:
```javascript
const { PoseLandmarker, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15');
```
Without `type="module"`, browsers reject dynamic imports and MediaPipe never initializes.

#### 2. Video Metadata Event Handler Order (CRITICAL FIX)
**Problem**: `onloadedmetadata` handler assigned AFTER `video.play()`, causing handler to miss the event
**Impact**: Canvas never received dimensions, pose detection never started
**Solution**: Moved handler assignment BEFORE `video.play()`:
```javascript
// ✅ CORRECT ORDER
video.onloadedmetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    startTransmission(); // or showCameraPreview()
}
video.play();
```

**Files corrected**:
- `telemedicine-patient.js`: Fixed in `startCamera()`
- `pose-medical-analyzer.js`: Fixed in `initializeCamera()`

**Why this matters**: In modern browsers, `loadedmetadata` can fire immediately when `play()` is called. If the handler isn't attached yet, the event is lost forever.

#### 3. Video Streaming Visibility (Doctor Interface)
**Problem**: Patient video element hidden behind placeholder, never made visible
**Solution** in `telemedicine-doctor.js`:
```javascript
// Hide placeholder completely
videoPlaceholder.style.display = 'none';
videoPlaceholder.style.visibility = 'hidden';

// Make video explicitly visible
remoteVideo.style.display = 'block';
remoteVideo.style.visibility = 'visible';
remoteVideo.style.opacity = '1';
remoteVideo.play(); // Force autoplay
```

#### 4. Status Messages (Doctor Interface)
**Problem**: "Esperando stream..." message appeared before session creation
**Solution**: Conditional display based on `isSessionActive` state:
- No session: Area hidden
- Session created: "👤 Esperando conexión del paciente"
- Patient connected: "⏳ Esperando stream de datos..."
- Data received: Message hidden, skeleton visible

#### 5. Canvas Z-Index and Styling
**Problem**: Canvas elements hidden behind other layers
**Solution**:
- `styles.css`: Added `z-index: 10` and `object-fit: contain` to `#canvas`
- Overlay: `z-index: 20` to stay above skeleton
- Patient canvas: inline `z-index: 10` in HTML

#### 6. Responsive Design for Mobile
**Solution**: Added media queries in `medico.html` for screens < 768px:
```css
@media (max-width: 768px) {
    .video-content {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto;
    }
    .patient-video-section { order: 1; } /* Top */
    .skeleton-analysis-section { order: 2; } /* Bottom */
}
```

### WebRTC Video Streaming (Previous Fix)
- **Synchronization Issue Resolved**: Fixed timing problem where patient sent WebRTC offer before doctor was ready
- **Server-side Coordination**: Added `doctor-ready-for-webrtc` event with 500ms delay after patient connection
- **Patient-side Wait**: Patient now waits for doctor readiness signal before initiating WebRTC connection

### Verified Functionality (All Fixed)
- ✅ MediaPipe loads correctly in all three interfaces
- ✅ Skeleton overlay visible on patient video feed (green)
- ✅ Skeleton analysis visible in doctor canvas (green/red)
- ✅ Skeleton visible in original application (blue)
- ✅ WebRTC video streaming working (patient video on doctor screen)
- ✅ Real-time pose data transmission (15-30 FPS)
- ✅ Canvas dimensions match video dimensions
- ✅ Status messages context-aware and accurate
- ✅ Responsive design works on mobile devices
- ✅ Session management stable
- ✅ Medical calculations accurate

### Critical Development Notes
**ALWAYS remember when working with video and MediaPipe**:
1. **Script tags**: Use `type="module"` for files with dynamic imports
2. **Event handlers**: Assign BEFORE calling `video.play()`
3. **Canvas dimensions**: Set from `video.videoWidth/Height` in `onloadedmetadata`
4. **Z-index**: Canvas needs explicit `z-index` to appear over video
5. **Visibility**: Video elements may need explicit visibility styles
6. **Testing order**: Test ES6 imports → Video metadata → Canvas draw → Data transmission

**Design System Consistency**:
1. **Always use Figtree font**: Add Google Fonts link in `<head>` for new HTML files
2. **Maintain dark theme**: Use color palette defined in Design System section
3. **Border radius**: 12px for cards/panels, 8px for buttons/inputs
4. **Component spacing**: Follow 8px/12px/16px/24px rhythm
5. **Button states**: Include hover effects with `:hover:not(:disabled)` selector
6. **Input focus**: Always style `:focus` state with blue accent (`#5b8def`)
7. **Semantic colors**: Green for success, Yellow for warnings, Red for errors, Blue for primary actions