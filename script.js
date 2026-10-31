// ----- DOM Elements -----
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const zoomDisplay = document.getElementById("zoomDisplay");
const modeDisplay = document.getElementById("modeDisplay");
const handStatusSpan = document.getElementById("handStatus");
const photosDiv = document.getElementById("photos");

// Ensure canvas and video fill the container properly
function resizeCanvas() {
    const container = document.querySelector(".container");
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    console.log("Canvas size:", canvas.width, "x", canvas.height);
}
window.addEventListener("resize", () => {
    setTimeout(resizeCanvas, 100);
});
window.addEventListener("load", () => {
    setTimeout(resizeCanvas, 200);
});

// ----- Camera transform state -----
let targetZoom = 1.0;
let targetPosX = 0;
let targetPosY = 0;
let movementLocked = false;

const MAX_ZOOM = 3.5;
const MIN_ZOOM = 1.0;
const PAN_LIMIT = 180;

// Smooth values for animation
let currentZoom = 1.0;
let currentPosX = 0;
let currentPosY = 0;

// Photo filter mode
let currentFilter = 0;
const filterNames = ["None", "Grayscale", "Sepia", "Invert"];
const toggleFilterBtn = document.getElementById("toggleFilterBtn");

// Apply video transform with mirror + pan + zoom
function applyVideoTransform() {
    // Smooth interpolation for fluid motion
    currentZoom += (targetZoom - currentZoom) * 0.2;
    currentPosX += (targetPosX - currentPosX) * 0.2;
    currentPosY += (targetPosY - currentPosY) * 0.2;
    
    // Apply transform with mirror for selfie view
    video.style.transform = `translate(${-currentPosX}px, ${-currentPosY}px) scale(${currentZoom}) scaleX(-1)`;
    zoomDisplay.innerText = targetZoom.toFixed(2) + "x";
}

function resetView() {
    targetZoom = 1.0;
    targetPosX = 0;
    targetPosY = 0;
    movementLocked = false;
    modeDisplay.innerText = "Reset ✓";
    setTimeout(() => { 
        if (modeDisplay.innerText === "Reset ✓") 
            modeDisplay.innerText = "Active"; 
    }, 800);
}

// Capture photo with current filter effect
function capturePhoto() {
    const tempCanvas = document.createElement("canvas");
    const displayWidth = canvas.width;
    const displayHeight = canvas.height;
    tempCanvas.width = displayWidth;
    tempCanvas.height = displayHeight;
    const tctx = tempCanvas.getContext("2d");
    
    // Draw current video frame
    tctx.drawImage(video, 0, 0, displayWidth, displayHeight);
    
    // Apply selected filter
    if (currentFilter === 1) {
        const imgData = tctx.getImageData(0, 0, displayWidth, displayHeight);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.34 * data[i] + 0.5 * data[i+1] + 0.16 * data[i+2];
            data[i] = gray;
            data[i+1] = gray;
            data[i+2] = gray;
        }
        tctx.putImageData(imgData, 0, 0);
    } else if (currentFilter === 2) {
        const imgData = tctx.getImageData(0, 0, displayWidth, displayHeight);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i+1], b = data[i+2];
            data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
            data[i+1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
            data[i+2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
        }
        tctx.putImageData(imgData, 0, 0);
    } else if (currentFilter === 3) {
        const imgData = tctx.getImageData(0, 0, displayWidth, displayHeight);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i+1] = 255 - data[i+1];
            data[i+2] = 255 - data[i+2];
        }
        tctx.putImageData(imgData, 0, 0);
    }
    
    const img = document.createElement("img");
    img.src = tempCanvas.toDataURL("image/jpeg", 0.9);
    img.style.width = "100px";
    img.style.borderRadius = "12px";
    img.style.cursor = "pointer";
    img.addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = img.src;
        a.download = `gesturecam_${Date.now()}.jpg`;
        a.click();
    });
    photosDiv.appendChild(img);
    img.scrollIntoView({ behavior: "smooth", block: "nearest" });
    
    // Flash effect
    const container = document.querySelector(".container");
    container.style.transition = "0.1s";
    container.style.boxShadow = "0 0 0 3px #22c55e, 0 0 0 6px rgba(34,197,94,0.4)";
    setTimeout(() => { 
        container.style.boxShadow = "0 25px 40px rgba(0,0,0,0.5), 0 0 0 2px rgba(34,211,238,0.2)"; 
    }, 200);
}

function clearGallery() {
    photosDiv.innerHTML = "";
}

// Draw hand landmarks with GREEN DOTS
function drawHandsAndFilter(results) {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        results.multiHandLandmarks.forEach(hand => {
            // Draw connections with green lines
            const connections = [
                [0,1],[1,2],[2,3],[3,4], [0,5],[5,6],[6,7],[7,8],
                [0,9],[9,10],[10,11],[11,12], [0,13],[13,14],[14,15],[15,16],
                [0,17],[17,18],[18,19],[19,20], [5,9],[9,13],[13,17]
            ];
            
            ctx.beginPath();
            ctx.strokeStyle = "#4ade80";
            ctx.lineWidth = 3;
            ctx.shadowBlur = 4;
            ctx.shadowColor = "#22c55e";
            
            connections.forEach(conn => {
                const p1 = hand[conn[0]];
                const p2 = hand[conn[1]];
                if(p1 && p2) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                    ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
                    ctx.stroke();
                }
            });
            
            // Draw GREEN DOTS for each landmark
            hand.forEach(point => {
                ctx.beginPath();
                ctx.arc(point.x * canvas.width, point.y * canvas.height, 7, 0, 2 * Math.PI);
                ctx.fillStyle = "#22c55e";
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(point.x * canvas.width, point.y * canvas.height, 3, 0, 2 * Math.PI);
                ctx.fillStyle = "#86efac";
                ctx.fill();
            });
            ctx.shadowBlur = 0;
        });
    }
}

// Gesture recognition - FIXED: Pinch IN = Zoom OUT, Pinch OUT = Zoom IN
function analyzeGestures(landmarks) {
    if (!landmarks || landmarks.length === 0) {
        handStatusSpan.innerText = "No hand";
        return { zoomDelta: 0, shouldReset: false, lockMovement: false };
    }
    
    const hand = landmarks[0];
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const middleTip = hand[12];
    const ringTip = hand[16];
    const pinkyTip = hand[20];
    const wrist = hand[0];
    const palmCenter = hand[9];
    
    // Calculate pinch distance between thumb and index finger
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const pinchDist = Math.hypot(dx, dy);
    
    // Calculate hand size for normalization
    const handSize = Math.hypot(wrist.x - palmCenter.x, wrist.y - palmCenter.y);
    const normalizedPinch = pinchDist / (handSize * 1.5);
    
    // Calculate finger spread (open hand detection)
    const indexExtend = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y);
    const middleExtend = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y);
    const avgExtend = (indexExtend + middleExtend) / 2;
    
    // Fist detection
    const tipDistances = [thumbTip, indexTip, middleTip, ringTip, pinkyTip].map(tip => 
        Math.hypot(tip.x - palmCenter.x, tip.y - palmCenter.y)
    );
    const avgFingerSpread = tipDistances.reduce((a,b)=>a+b,0)/5;
    const isFist = avgFingerSpread < 0.07;
    
    // Two-finger V sign detection for reset
    const indexToWrist = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y);
    const middleToWrist = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y);
    const ringToWrist = Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y);
    const pinkyToWrist = Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y);
    const isTwoFinger = (indexToWrist > 0.22 && middleToWrist > 0.22) && (ringToWrist < 0.18 && pinkyToWrist < 0.18);
    
    // ZOOM LOGIC - FIXED:
    // Pinch IN (fingers close together, small distance) = Zoom OUT (negative delta)
    // Pinch OUT (fingers spread apart, large distance) = Zoom IN (positive delta)
    let zoomDelta = 0;
    let isPinching = false;
    
    if (normalizedPinch < 0.35) {
        // Pinch IN - fingers close together -> Zoom OUT
        zoomDelta = -0.035;
        isPinching = true;
        handStatusSpan.innerText = "🤏 Pinch IN (Zoom Out)";
    } else if (avgExtend > 0.28 || normalizedPinch > 0.65) {
        // Pinch OUT - fingers spread apart OR open hand -> Zoom IN
        zoomDelta = 0.035;
        handStatusSpan.innerText = "🖐️ Pinch OUT (Zoom In)";
    } else if (isFist) {
        handStatusSpan.innerText = "👊 Fist (Locked)";
    } else if (isTwoFinger) {
        handStatusSpan.innerText = "✌️ Victory (Reset)";
    } else {
        handStatusSpan.innerText = "✋ Tracking";
    }
    
    let resetTrigger = false;
    let lockMovement = isFist;
    
    if (isTwoFinger) resetTrigger = true;
    
    return { zoomDelta, shouldReset: resetTrigger, lockMovement: lockMovement };
}

// Main MediaPipe callback
function onResults(results) {
    drawHandsAndFilter(results);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const gestures = analyzeGestures(results.multiHandLandmarks);
        movementLocked = gestures.lockMovement;
        
        // Handle zoom with proper direction
        if (gestures.zoomDelta !== 0) {
            let newZoom = targetZoom + gestures.zoomDelta;
            newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
            targetZoom = newZoom;
            
            // Update mode display based on zoom direction
            if (gestures.zoomDelta < 0) {
                modeDisplay.innerText = "🔍 Zoom OUT (Pinch IN)";
            } else if (gestures.zoomDelta > 0) {
                modeDisplay.innerText = "🔍 Zoom IN (Pinch OUT)";
            }
            
            setTimeout(() => { 
                if (modeDisplay.innerText !== "Reset ✓" && modeDisplay.innerText !== "✨ Reset ✨") 
                    modeDisplay.innerText = "Active"; 
            }, 500);
        }
        
        // Handle reset
        if (gestures.shouldReset) {
            resetView();
            modeDisplay.innerText = "✨ Reset ✨";
            setTimeout(() => { 
                if (modeDisplay.innerText === "✨ Reset ✨") 
                    modeDisplay.innerText = "Active"; 
            }, 600);
        }
        
        // Handle pan movement - MOVE HAND TO MOVE CAMERA
        if (!movementLocked) {
            const handCenter = results.multiHandLandmarks[0][9];
            if (handCenter) {
                // Map hand position to camera pan offset
                const rawPanX = (handCenter.x - 0.5) * 2.5 * PAN_LIMIT;
                const rawPanY = (handCenter.y - 0.5) * 2.0 * PAN_LIMIT;
                targetPosX = Math.min(PAN_LIMIT, Math.max(-PAN_LIMIT, rawPanX));
                targetPosY = Math.min(PAN_LIMIT * 0.8, Math.max(-PAN_LIMIT * 0.8, rawPanY));
            }
        } else {
            modeDisplay.innerText = "🔒 Locked";
            setTimeout(() => { 
                if (modeDisplay.innerText === "🔒 Locked") 
                    modeDisplay.innerText = "Active"; 
            }, 500);
        }
    } else {
        handStatusSpan.innerText = "No hand detected";
    }
}

// ----- MediaPipe Setup -----
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});

hands.onResults(onResults);

// Camera initialization with proper settings
const camera = new Camera(video, {
    onFrame: async () => {
        await hands.send({ image: video });
    },
    width: 1280,
    height: 720
});

camera.start().then(() => {
    console.log("Camera started successfully");
    resizeCanvas();
    
    // Ensure video fills the container
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
});

// Event listeners
document.getElementById("captureBtn").addEventListener("click", capturePhoto);
document.getElementById("resetBtn").addEventListener("click", () => resetView());
document.getElementById("clearPhotosBtn").addEventListener("click", clearGallery);
document.getElementById("smallClearBtn").addEventListener("click", clearGallery);

toggleFilterBtn.addEventListener("click", () => {
    currentFilter = (currentFilter + 1) % 4;
    toggleFilterBtn.innerHTML = `🎨 Filter: ${filterNames[currentFilter]}`;
    modeDisplay.innerText = `Filter: ${filterNames[currentFilter]}`;
    setTimeout(() => { 
        if (modeDisplay.innerText.includes("Filter")) 
            modeDisplay.innerText = "Active"; 
    }, 1000);
});

video.addEventListener("loadedmetadata", () => {
    console.log("Video metadata loaded");
    resizeCanvas();
    resetView();
});

// Animation loop for smooth transforms
function animationLoop() {
    applyVideoTransform();
    requestAnimationFrame(animationLoop);
}
animationLoop();

// Handle resize with proper timing
let resizeTimeout;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        resizeCanvas();
    }, 150);
});

// Initial resize
setTimeout(() => {
    resizeCanvas();
}, 500);