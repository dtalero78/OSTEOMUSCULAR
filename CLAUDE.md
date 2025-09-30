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

## Development Guidelines

### Medical Application Context
- This is a **telemedicine diagnostic support tool**
- All changes must consider clinical accuracy and patient safety
- UI changes should maintain medical professional standards
- Code modifications should preserve medical calculation precision
- New features should enhance remote consultation workflow
- Telemedicine features must ensure reliable doctor-patient communication

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

### WebRTC Video Streaming Fix (2025-09-30)
- **Synchronization Issue Resolved**: Fixed timing problem where patient sent WebRTC offer before doctor was ready
- **Server-side Coordination**: Added `doctor-ready-for-webrtc` event with 500ms delay after patient connection
- **Patient-side Wait**: Patient now waits for doctor readiness signal before initiating WebRTC connection
- **Status Messages**: Improved UI feedback with context-aware messages:
  - Before patient connects: "👤 Esperando conexión del paciente"
  - Patient connected, no data: "⏳ Esperando stream de datos del paciente..."
  - Data flowing: Message auto-hides, skeleton displays
- **Result**: WebRTC video streaming now works reliably, doctor receives patient video feed successfully

### Key Changes
**server.js**:
- Added 500ms delayed `doctor-ready-for-webrtc` event after `session-joined`
- Ensures doctor interface is fully initialized before WebRTC negotiation

**telemedicine-patient.js**:
- Listens for `doctor-ready-for-webrtc` before calling `setupWebRTC()`
- Removed premature WebRTC initialization from `startCamera()`

**telemedicine-doctor.js**:
- Dynamic status messages based on connection state
- Auto-hide message when pose data arrives
- Proper message restoration on patient disconnect

### Skeleton Visualization Fixes (Previous)
- **Patient Interface**: Fixed skeleton not appearing over video by adding `z-index: 10` and `pointer-events: none` to pose canvas
- **Doctor Interface**: Added proper CSS styling for analysis canvas with dark background and explicit dimensions
- **Canvas Layering**: Corrected positioning of "no patient" message to not interfere with skeleton display
- **Real-time Display**: Both patient and doctor now properly see skeleton visualization during telemedicine sessions

### Verified Functionality
- ✅ WebRTC video streaming working (patient video appears on doctor screen)
- ✅ Patient sees skeleton overlay on their video feed
- ✅ Doctor sees skeleton analysis in dedicated canvas
- ✅ Real-time streaming of pose data working correctly
- ✅ Session management and doctor-patient connections stable
- ✅ Medical calculations and guided sequences operational
- ✅ Context-aware status messages for better UX