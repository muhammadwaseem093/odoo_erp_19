/** @odoo-module **/

import { FormController } from "@web/views/form/form_controller";
import { patch } from "@web/core/utils/patch";
import { onMounted, onWillUnmount } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";

/**
 * Face Enrollment Wizard - Multi-Step Guided Capture
 * Captures face in 5 positions: Front, Left, Right, Up, Down
 */

let cameraStream = null;
let animationLoop = null;

// Enrollment steps configuration
const ENROLLMENT_STEPS = [
    { id: 'front', label: 'Look Straight', icon: 'fa-user', instruction: 'Look directly at the camera' },
    { id: 'left', label: 'Turn Left', icon: 'fa-arrow-left', instruction: 'Slowly turn your head to the left' },
    { id: 'right', label: 'Turn Right', icon: 'fa-arrow-right', instruction: 'Slowly turn your head to the right' },
    { id: 'up', label: 'Look Up', icon: 'fa-arrow-up', instruction: 'Slowly tilt your head up' },
    { id: 'down', label: 'Look Down', icon: 'fa-arrow-down', instruction: 'Slowly tilt your head down' },
];

console.log('Face enrollment: Multi-step module loading...');

// Helper function to get wizard ID from multiple sources
function getWizardId() {
    let wizardId = null;
    
    // Method 0: Check global variable set by controller
    if (window._enrollmentWizardId) {
        console.log('Face enrollment: Got ID from global _enrollmentWizardId');
        return window._enrollmentWizardId;
    }
    
    // Method 1: Try from OWL form component
    try {
        const formViews = document.querySelectorAll('.o_dialog .o_form_view, .modal .o_form_view, .o_form_view');
        for (const formView of formViews) {
            if (formView.__owl__) {
                // Try different OWL component structures
                const owl = formView.__owl__;
                
                // Structure 1: component.model.root.resId
                if (owl.component?.model?.root?.resId) {
                    wizardId = owl.component.model.root.resId;
                    console.log('Face enrollment: Got ID from component.model.root.resId');
                    break;
                }
                
                // Structure 2: bdom.component.model.root
                if (owl.bdom?.component?.model?.root?.resId) {
                    wizardId = owl.bdom.component.model.root.resId;
                    console.log('Face enrollment: Got ID from bdom.component');
                    break;
                }
                
                // Structure 3: component.props.resId
                if (owl.component?.props?.resId) {
                    wizardId = owl.component.props.resId;
                    console.log('Face enrollment: Got ID from component.props.resId');
                    break;
                }
                
                // Structure 4: props.record.resId
                if (owl.component?.props?.record?.resId) {
                    wizardId = owl.component.props.record.resId;
                    console.log('Face enrollment: Got ID from props.record.resId');
                    break;
                }
            }
        }
    } catch (e) {
        console.log('Face enrollment: OWL method failed:', e);
    }
    
    // Method 2: Try from URL hash
    if (!wizardId) {
        try {
            const hashMatch = window.location.hash.match(/id=(\d+)/);
            if (hashMatch) {
                wizardId = parseInt(hashMatch[1]);
                console.log('Face enrollment: Got ID from URL hash');
            }
        } catch (e) {}
    }
    
    // Method 3: Try from action context in body data attribute
    if (!wizardId) {
        try {
            const body = document.body;
            if (body.dataset.actionContext) {
                const ctx = JSON.parse(body.dataset.actionContext);
                if (ctx.res_id) {
                    wizardId = ctx.res_id;
                    console.log('Face enrollment: Got ID from body dataset');
                }
            }
        } catch (e) {}
    }
    
    // Method 4: Find save button's data-res-id
    if (!wizardId) {
        try {
            const saveBtn = document.querySelector('.o_dialog button[data-res-id], .modal button[data-res-id]');
            if (saveBtn && saveBtn.dataset.resId) {
                wizardId = parseInt(saveBtn.dataset.resId);
                console.log('Face enrollment: Got ID from button data-res-id');
            }
        } catch (e) {}
    }
    
    return wizardId;
}

// Helper to extract numeric ID from various OWL field formats
function extractNumericId(field) {
    if (!field) return null;
    
    // If it's already a number
    if (typeof field === 'number') return field;
    
    // If it's a string that looks like a number
    if (typeof field === 'string' && /^\d+$/.test(field)) return parseInt(field);
    
    // If it's an array [id, name]
    if (Array.isArray(field) && field.length > 0) {
        return typeof field[0] === 'number' ? field[0] : null;
    }
    
    // If it's an object with resId (OWL record)
    if (typeof field === 'object') {
        // Try various property names used in OWL
        if (field.resId !== undefined) return field.resId;
        if (field.id !== undefined) return field.id;
        if (field.res_id !== undefined) return field.res_id;
        
        // Try to access raw data
        if (field._values && field._values.id !== undefined) return field._values.id;
        
        // For Proxy objects, try to get the underlying target
        try {
            const json = JSON.stringify(field);
            const parsed = JSON.parse(json);
            if (parsed && typeof parsed === 'object') {
                if (parsed.resId !== undefined) return parsed.resId;
                if (parsed.id !== undefined) return parsed.id;
            }
        } catch (e) {}
    }
    
    return null;
}

// Helper function to get employee ID
function getEmployeeId() {
    // Method 0: Check global variable set by controller
    if (window._enrollmentEmployeeId && typeof window._enrollmentEmployeeId === 'number') {
        return window._enrollmentEmployeeId;
    }
    
    // Method 1: Try from OWL form component data
    try {
        const formViews = document.querySelectorAll('.o_dialog .o_form_view, .modal .o_form_view, .o_form_view');
        for (const formView of formViews) {
            if (formView.__owl__) {
                const owl = formView.__owl__;
                
                // Try to get from model data
                const root = owl.component?.model?.root || owl.bdom?.component?.model?.root;
                if (root && root.data && root.data.employee_id) {
                    const id = extractNumericId(root.data.employee_id);
                    if (id) {
                        console.log('Face enrollment: Got employee ID from OWL data:', id);
                        return id;
                    }
                }
            }
        }
    } catch (e) {
        console.log('Face enrollment: Could not get employee ID from OWL:', e);
    }
    
    // Method 2: Try from action context
    try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const actionStr = hashParams.get('action');
        if (actionStr) {
            // Check session storage for action context
            const actionData = sessionStorage.getItem(`action_${actionStr}`);
            if (actionData) {
                const ctx = JSON.parse(actionData);
                if (ctx.default_employee_id) {
                    console.log('Face enrollment: Got employee ID from session action');
                    return ctx.default_employee_id;
                }
            }
        }
    } catch (e) {}
    
    return null;
}

// Patch FormController
patch(FormController.prototype, {
    setup() {
        const resModel = this.props.resModel;
        const isFaceWizard = resModel === 'hr.employee.face.enrollment.wizard';
        
        if (isFaceWizard) {
            console.log('Face enrollment: Wizard detected');
            
            // Store reference to controller for ID retrieval
            const self = this;
            
            onMounted(() => {
                // Try to get wizard ID and employee ID from the controller's model
                setTimeout(() => {
                    try {
                        if (self.model && self.model.root) {
                            const root = self.model.root;
                            if (root.resId) {
                                window._enrollmentWizardId = root.resId;
                                console.log('Face enrollment: Captured wizard ID from controller:', window._enrollmentWizardId);
                            }
                            // Get employee_id from the form data
                            if (root.data && root.data.employee_id) {
                                // employee_id is a Many2one OWL record - extract the numeric ID
                                const empField = root.data.employee_id;
                                window._enrollmentEmployeeId = extractNumericId(empField);
                                console.log('Face enrollment: Captured employee ID:', window._enrollmentEmployeeId);
                            }
                        }
                    } catch (e) {
                        console.log('Face enrollment: Could not get IDs from controller:', e);
                    }
                    initMultiStepEnrollment();
                }, 300);
            });
            
            onWillUnmount(() => {
                cleanupCamera();
                window._enrollmentWizardId = null;
                window._enrollmentEmployeeId = null;
            });
        }
        
        super.setup(...arguments);
    }
});

function initMultiStepEnrollment() {
    const container = document.getElementById('webcam-container');
    if (container && !container.dataset.initialized) {
        container.dataset.initialized = 'true';
        setupMultiStepUI(container);
    } else if (!container) {
        setTimeout(() => initMultiStepEnrollment(), 200);
    }
}

async function setupMultiStepUI(container) {
    cleanupCamera();
    
    // Initialize state
    window._enrollmentState = {
        currentStep: 0,
        capturedImages: {},
        wizardId: null,
        employeeId: null
    };
    
    // Get wizard ID and employee ID
    window._enrollmentState.wizardId = getWizardId();
    window._enrollmentState.employeeId = getEmployeeId();
    console.log('Face enrollment: Initial wizard ID =', window._enrollmentState.wizardId, 'employee ID =', window._enrollmentState.employeeId);
    
    container.innerHTML = '';
    container.style.cssText = 'background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%); min-height: 500px; padding: 20px; border-radius: 12px;';
    
    // Create main layout
    const layout = document.createElement('div');
    layout.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 15px;';
    
    // Step indicators
    const stepsBar = createStepsBar();
    layout.appendChild(stepsBar);
    
    // Video wrapper
    const videoWrapper = document.createElement('div');
    videoWrapper.id = 'video-wrapper';
    videoWrapper.style.cssText = 'position: relative; width: 100%; max-width: 500px; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.4);';
    
    const video = document.createElement('video');
    video.id = 'face-video';
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.cssText = 'width: 100%; display: block; transform: scaleX(-1); background: #000;';
    
    const overlay = document.createElement('canvas');
    overlay.id = 'face-overlay';
    overlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: scaleX(-1); pointer-events: none;';
    
    // Direction indicator
    const directionIndicator = document.createElement('div');
    directionIndicator.id = 'direction-indicator';
    directionIndicator.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none;';
    
    videoWrapper.appendChild(video);
    videoWrapper.appendChild(overlay);
    videoWrapper.appendChild(directionIndicator);
    layout.appendChild(videoWrapper);
    
    // Instruction panel
    const instructionPanel = document.createElement('div');
    instructionPanel.id = 'instruction-panel';
    instructionPanel.style.cssText = 'text-align: center; padding: 15px; background: rgba(34, 197, 94, 0.1); border-radius: 12px; border: 1px solid rgba(34, 197, 94, 0.3); max-width: 500px; width: 100%;';
    instructionPanel.innerHTML = `
        <div style="font-size: 18px; font-weight: 600; color: #22c55e; margin-bottom: 5px;">
            <i class="fa fa-user"></i> Look Straight
        </div>
        <div style="color: #9ca3af; font-size: 14px;">Look directly at the camera</div>
    `;
    layout.appendChild(instructionPanel);
    
    // Capture button
    const captureBtn = document.createElement('button');
    captureBtn.id = 'btn-capture-step';
    captureBtn.className = 'btn btn-lg';
    captureBtn.style.cssText = 'background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border: none; color: white; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4); transition: all 0.3s ease;';
    captureBtn.innerHTML = '<i class="fa fa-camera"></i> Capture';
    captureBtn.onclick = captureCurrentStep;
    layout.appendChild(captureBtn);
    
    // Captured thumbnails
    const thumbnailsRow = document.createElement('div');
    thumbnailsRow.id = 'thumbnails-row';
    thumbnailsRow.style.cssText = 'display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; justify-content: center;';
    layout.appendChild(thumbnailsRow);
    
    // Hidden canvas for capture
    const captureCanvas = document.createElement('canvas');
    captureCanvas.id = 'capture-canvas';
    captureCanvas.style.display = 'none';
    layout.appendChild(captureCanvas);
    
    container.appendChild(layout);
    
    // Store references
    window._faceEnrollment = { video, overlay, captureCanvas };
    
    // Start camera
    await startCamera(video, overlay);
}

function createStepsBar() {
    const stepsBar = document.createElement('div');
    stepsBar.id = 'steps-bar';
    stepsBar.style.cssText = 'display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; justify-content: center;';
    
    ENROLLMENT_STEPS.forEach((step, idx) => {
        const stepEl = document.createElement('div');
        stepEl.id = `step-${step.id}`;
        stepEl.style.cssText = `
            display: flex; align-items: center; gap: 6px; padding: 8px 12px; 
            border-radius: 20px; font-size: 12px; font-weight: 500;
            transition: all 0.3s ease;
            ${idx === 0 ? 'background: rgba(34, 197, 94, 0.2); color: #22c55e; border: 1px solid #22c55e;' : 'background: rgba(255,255,255,0.1); color: #6b7280; border: 1px solid transparent;'}
        `;
        stepEl.innerHTML = `<i class="fa ${step.icon}"></i> ${step.label}`;
        stepsBar.appendChild(stepEl);
    });
    
    return stepsBar;
}

async function startCamera(video, overlay) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false
        });
        
        cameraStream = stream;
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            video.play();
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            startGuideAnimation(overlay);
        };
    } catch (error) {
        console.error('Camera error:', error);
        const panel = document.getElementById('instruction-panel');
        if (panel) {
            panel.innerHTML = `<div style="color: #ef4444;"><i class="fa fa-exclamation-triangle"></i> Camera error: ${error.message}</div>`;
        }
    }
}

function startGuideAnimation(overlay) {
    const ctx = overlay.getContext('2d');
    let frame = 0;
    
    function animate() {
        if (!cameraStream) return;
        
        const state = window._enrollmentState;
        // Stop animation if state is gone or enrollment complete
        if (!state || state.currentStep >= ENROLLMENT_STEPS.length) {
            return;
        }
        
        frame++;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        
        const currentStep = ENROLLMENT_STEPS[state.currentStep];
        if (currentStep) {
            drawFaceGuide(ctx, overlay.width, overlay.height, frame, currentStep.id);
        }
        
        animationLoop = requestAnimationFrame(animate);
    }
    
    animate();
}

function drawFaceGuide(ctx, width, height, frame, direction) {
    const centerX = width / 2;
    const centerY = height / 2;
    const ovalWidth = width * 0.32;
    const ovalHeight = height * 0.45;
    
    const time = frame * 0.03;
    const pulse = Math.sin(time * 2) * 0.02 + 1;
    
    // Draw main face oval
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, ovalWidth * pulse, ovalHeight * pulse, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Glow effect
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, ovalWidth * pulse + 6, ovalHeight * pulse + 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.2)';
    ctx.lineWidth = 12;
    ctx.stroke();
    
    // Draw direction arrow based on current step
    const arrowSize = 50;
    const arrowOffset = ovalWidth + 40;
    
    ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    
    // Animated arrow pulse
    const arrowPulse = Math.sin(time * 3) * 10;
    
    switch(direction) {
        case 'left':
            drawArrow(ctx, centerX - arrowOffset - arrowPulse, centerY, 'left', arrowSize);
            break;
        case 'right':
            drawArrow(ctx, centerX + arrowOffset + arrowPulse, centerY, 'right', arrowSize);
            break;
        case 'up':
            drawArrow(ctx, centerX, centerY - (ovalHeight * 0.7) - arrowPulse, 'up', arrowSize);
            break;
        case 'down':
            drawArrow(ctx, centerX, centerY + (ovalHeight * 0.7) + arrowPulse, 'down', arrowSize);
            break;
        case 'front':
        default:
            // Draw scanning effect for front
            const scanY = centerY + Math.sin(time) * ovalHeight * 0.6;
            const gradient = ctx.createLinearGradient(centerX - ovalWidth, scanY, centerX + ovalWidth, scanY);
            gradient.addColorStop(0, 'rgba(34, 197, 94, 0)');
            gradient.addColorStop(0.5, 'rgba(34, 197, 94, 0.5)');
            gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX - ovalWidth * 0.8, scanY);
            ctx.lineTo(centerX + ovalWidth * 0.8, scanY);
            ctx.stroke();
            break;
    }
    
    // Corner brackets
    drawCornerBrackets(ctx, width, height);
}

function drawArrow(ctx, x, y, direction, size) {
    ctx.save();
    ctx.translate(x, y);
    
    const halfSize = size / 2;
    
    ctx.beginPath();
    switch(direction) {
        case 'left':
            ctx.moveTo(halfSize, -halfSize * 0.6);
            ctx.lineTo(-halfSize * 0.5, 0);
            ctx.lineTo(halfSize, halfSize * 0.6);
            break;
        case 'right':
            ctx.moveTo(-halfSize, -halfSize * 0.6);
            ctx.lineTo(halfSize * 0.5, 0);
            ctx.lineTo(-halfSize, halfSize * 0.6);
            break;
        case 'up':
            ctx.moveTo(-halfSize * 0.6, halfSize);
            ctx.lineTo(0, -halfSize * 0.5);
            ctx.lineTo(halfSize * 0.6, halfSize);
            break;
        case 'down':
            ctx.moveTo(-halfSize * 0.6, -halfSize);
            ctx.lineTo(0, halfSize * 0.5);
            ctx.lineTo(halfSize * 0.6, -halfSize);
            break;
    }
    ctx.stroke();
    ctx.restore();
}

function drawCornerBrackets(ctx, width, height) {
    const margin = 25;
    const size = 35;
    
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    // Top-left
    ctx.beginPath();
    ctx.moveTo(margin, margin + size);
    ctx.lineTo(margin, margin);
    ctx.lineTo(margin + size, margin);
    ctx.stroke();
    
    // Top-right
    ctx.beginPath();
    ctx.moveTo(width - margin - size, margin);
    ctx.lineTo(width - margin, margin);
    ctx.lineTo(width - margin, margin + size);
    ctx.stroke();
    
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(margin, height - margin - size);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(margin + size, height - margin);
    ctx.stroke();
    
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(width - margin - size, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.lineTo(width - margin, height - margin - size);
    ctx.stroke();
}

function captureCurrentStep() {
    const state = window._enrollmentState;
    const fe = window._faceEnrollment;
    
    if (!state || !fe || !fe.video) return;
    if (state.currentStep >= ENROLLMENT_STEPS.length) return;
    
    const { video, captureCanvas } = fe;
    const currentStep = ENROLLMENT_STEPS[state.currentStep];
    if (!currentStep) return;
    
    // Capture image
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const ctx = captureCanvas.getContext('2d');
    ctx.translate(captureCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    
    const imageData = captureCanvas.toDataURL('image/jpeg', 0.9);
    
    // Store captured image
    state.capturedImages[currentStep.id] = imageData;
    
    // Update thumbnail
    addThumbnail(currentStep.id, imageData);
    
    // Mark step as complete
    const stepEl = document.getElementById(`step-${currentStep.id}`);
    if (stepEl) {
        stepEl.style.background = 'rgba(34, 197, 94, 0.3)';
        stepEl.style.color = '#22c55e';
        stepEl.style.borderColor = '#22c55e';
        stepEl.innerHTML = `<i class="fa fa-check"></i> ${currentStep.label}`;
    }
    
    // Move to next step or complete
    state.currentStep++;
    
    if (state.currentStep >= ENROLLMENT_STEPS.length) {
        completeEnrollment();
    } else {
        updateUIForStep(state.currentStep);
    }
}

function addThumbnail(stepId, imageData) {
    const row = document.getElementById('thumbnails-row');
    if (!row) return;
    
    const thumb = document.createElement('div');
    thumb.style.cssText = 'position: relative; width: 60px; height: 60px; border-radius: 8px; overflow: hidden; border: 2px solid #22c55e;';
    thumb.innerHTML = `
        <img src="${imageData}" style="width: 100%; height: 100%; object-fit: cover;">
        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); color: #22c55e; font-size: 9px; text-align: center; padding: 2px;">${stepId}</div>
    `;
    row.appendChild(thumb);
}

function updateUIForStep(stepIndex) {
    const step = ENROLLMENT_STEPS[stepIndex];
    
    // Update instruction panel
    const panel = document.getElementById('instruction-panel');
    if (panel) {
        panel.innerHTML = `
            <div style="font-size: 18px; font-weight: 600; color: #22c55e; margin-bottom: 5px;">
                <i class="fa ${step.icon}"></i> ${step.label}
            </div>
            <div style="color: #9ca3af; font-size: 14px;">${step.instruction}</div>
        `;
    }
    
    // Update step indicator
    const stepEl = document.getElementById(`step-${step.id}`);
    if (stepEl) {
        stepEl.style.background = 'rgba(34, 197, 94, 0.2)';
        stepEl.style.color = '#22c55e';
        stepEl.style.borderColor = '#22c55e';
    }
}

async function completeEnrollment() {
    const state = window._enrollmentState;
    
    // Stop animation loop
    if (animationLoop) {
        cancelAnimationFrame(animationLoop);
        animationLoop = null;
    }
    
    // Update UI to show completing
    const panel = document.getElementById('instruction-panel');
    if (panel) {
        panel.innerHTML = `
            <div style="font-size: 18px; font-weight: 600; color: #22c55e;">
                <i class="fa fa-spinner fa-spin"></i> Processing enrollment...
            </div>
            <div style="color: #9ca3af; font-size: 14px;">Saving your face data</div>
        `;
    }
    
    const captureBtn = document.getElementById('btn-capture-step');
    if (captureBtn) {
        captureBtn.disabled = true;
        captureBtn.style.opacity = '0.5';
    }
    
    try {
        // Get wizard ID and employee ID
        let wizardId = getWizardId() || state.wizardId;
        let employeeId = getEmployeeId() || state.employeeId;
        
        // Ensure we have numeric IDs
        wizardId = extractNumericId(wizardId);
        employeeId = extractNumericId(employeeId);
        
        console.log('Face enrollment: Completing with wizard ID =', wizardId, '(type:', typeof wizardId, '), employee ID =', employeeId, '(type:', typeof employeeId, ')');
        
        if (!wizardId && !employeeId) {
            throw new Error('Could not find wizard or employee ID. Please close and reopen the dialog.');
        }
        
        // Validate that we have valid numeric IDs
        if (employeeId && (typeof employeeId !== 'number' || isNaN(employeeId))) {
            console.error('Invalid employee ID type:', typeof employeeId, 'value:', employeeId);
            throw new Error('Invalid employee ID. Please close and reopen the dialog.');
        }
        
        // Send to server - controller can work with either wizard_id or employee_id
        const result = await rpc('/hr_attendance_face/complete_enrollment', {
            wizard_id: wizardId || null,
            employee_id: employeeId || null,
            images: state.capturedImages
        });
        
        if (result.success) {
            panel.innerHTML = `
                <div style="font-size: 20px; font-weight: 600; color: #22c55e;">
                    <i class="fa fa-check-circle"></i> Enrollment Complete!
                </div>
                <div style="color: #9ca3af; font-size: 14px; margin-top: 5px;">Face data saved successfully</div>
            `;
            
            // Auto-close after delay
            setTimeout(() => {
                const cancelBtn = document.querySelector('.o_dialog .btn-secondary, .modal .btn-secondary');
                if (cancelBtn) cancelBtn.click();
            }, 2000);
        } else {
            throw new Error(result.error || 'Enrollment failed');
        }
        
    } catch (error) {
        console.error('Enrollment error:', error);
        panel.innerHTML = `
            <div style="font-size: 18px; font-weight: 600; color: #ef4444;">
                <i class="fa fa-exclamation-triangle"></i> Enrollment Failed
            </div>
            <div style="color: #9ca3af; font-size: 14px;">${error.message}</div>
        `;
        
        if (captureBtn) {
            captureBtn.disabled = false;
            captureBtn.style.opacity = '1';
            captureBtn.innerHTML = '<i class="fa fa-redo"></i> Retry';
            captureBtn.onclick = () => {
                state.currentStep = 0;
                state.capturedImages = {};
                document.getElementById('thumbnails-row').innerHTML = '';
                ENROLLMENT_STEPS.forEach((step, idx) => {
                    const el = document.getElementById(`step-${step.id}`);
                    if (el) {
                        el.style.background = idx === 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)';
                        el.style.color = idx === 0 ? '#22c55e' : '#6b7280';
                        el.style.borderColor = idx === 0 ? '#22c55e' : 'transparent';
                        el.innerHTML = `<i class="fa ${step.icon}"></i> ${step.label}`;
                    }
                });
                updateUIForStep(0);
                captureBtn.innerHTML = '<i class="fa fa-camera"></i> Capture';
                captureBtn.onclick = captureCurrentStep;
            };
        }
    }
}

function cleanupCamera() {
    if (animationLoop) {
        cancelAnimationFrame(animationLoop);
        animationLoop = null;
    }
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    window._faceEnrollment = null;
    window._enrollmentState = null;
}

// Cleanup on dialog close
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-close') ||
        e.target.closest('.btn-close') ||
        e.target.classList.contains('o_form_button_cancel') ||
        (e.target.tagName === 'BUTTON' && e.target.textContent.trim() === 'Cancel')) {
        setTimeout(cleanupCamera, 100);
    }
}, true);

console.log('Face enrollment: Multi-step module loaded');
