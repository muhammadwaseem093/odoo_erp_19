/** @odoo-module **/

import { Component, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

/**
 * Face Recognition Kiosk Component
 * Integrates with the HR Attendance Kiosk for face-based check-in/check-out
 */
export class FaceRecognitionKiosk extends Component {
    static template = "hr_attendance_face.FaceRecognitionKiosk";
    
    setup() {
        this.rpc = useService("rpc");
        
        this.state = useState({
            isInitialized: false,
            isStreaming: false,
            isProcessing: false,
            faceDetected: false,
            recognizedEmployee: null,
            errorMessage: null,
            showPinFallback: false,
            settings: null,
        });

        this.videoStream = null;
        this.videoElement = null;
        this.detectInterval = null;
        this.autoCapturePending = false;

        onMounted(() => this.initialize());
        onWillUnmount(() => this.cleanup());
    }

    async initialize() {
        try {
            // Load face recognition settings
            await this.loadSettings();
            
            if (this.state.settings?.enabled) {
                await this.startCamera();
            }
            
            this.state.isInitialized = true;
        } catch (error) {
            console.error('Initialization error:', error);
            this.state.errorMessage = 'Failed to initialize face recognition';
        }
    }

    async loadSettings() {
        const token = this.props.token || this.getKioskToken();
        
        const result = await this.rpc('/hr_attendance_face/get_settings', { token });
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        this.state.settings = result;
    }

    getKioskToken() {
        // Extract token from URL
        const path = window.location.pathname;
        const match = path.match(/\/hr_attendance\/([^\/]+)/);
        return match ? match[1] : null;
    }

    async startCamera() {
        try {
            const constraints = {
                video: this.getVideoConstraints()
            };

            this.videoStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            this.videoElement = document.getElementById('face-kiosk-video');
            if (this.videoElement) {
                this.videoElement.srcObject = this.videoStream;
                await this.videoElement.play();
                this.state.isStreaming = true;

                // Start face detection
                this.startFaceDetection();
            }
        } catch (error) {
            console.error('Camera error:', error);
            this.state.errorMessage = 'Camera access denied or not available';
            this.state.showPinFallback = this.state.settings?.fallback_pin;
        }
    }

    getVideoConstraints() {
        const quality = this.state.settings?.capture_quality || 'medium';
        const resolutions = {
            'low': { width: 320, height: 240 },
            'medium': { width: 640, height: 480 },
            'high': { width: 1280, height: 720 }
        };

        return {
            width: { ideal: resolutions[quality].width },
            height: { ideal: resolutions[quality].height },
            facingMode: 'user'
        };
    }

    startFaceDetection() {
        if (this.detectInterval) {
            clearInterval(this.detectInterval);
        }

        this.detectInterval = setInterval(() => {
            this.detectAndRecognize();
        }, 500); // Check every 500ms
    }

    async detectAndRecognize() {
        if (!this.state.isStreaming || this.state.isProcessing) return;

        try {
            const imageData = this.captureFrame();
            if (!imageData) return;

            // First, detect if there's a face
            const detectResult = await this.rpc('/hr_attendance_face/detect_face', {
                image_data: imageData
            });

            this.state.faceDetected = detectResult.detected;

            if (detectResult.detected) {
                // If auto-capture is enabled and face is detected
                if (this.state.settings?.auto_capture && !this.autoCapturePending) {
                    this.autoCapturePending = true;
                    
                    setTimeout(() => {
                        this.recognizeFace(imageData);
                        this.autoCapturePending = false;
                    }, this.state.settings.auto_capture_delay || 2000);
                }
            }
        } catch (error) {
            console.error('Detection error:', error);
        }
    }

    captureFrame() {
        if (!this.videoElement) return null;

        const canvas = document.createElement('canvas');
        canvas.width = this.videoElement.videoWidth || 640;
        canvas.height = this.videoElement.videoHeight || 480;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
        
        return canvas.toDataURL('image/jpeg', 0.9);
    }

    async recognizeFace(imageData) {
        if (this.state.isProcessing) return;

        this.state.isProcessing = true;
        this.state.errorMessage = null;

        try {
            const token = this.getKioskToken();
            
            const result = await this.rpc('/hr_attendance_face/recognize', {
                token: token,
                image_data: imageData || this.captureFrame()
            });

            if (result.success) {
                this.state.recognizedEmployee = result;
                // Trigger attendance success animation/notification
                this.showSuccessNotification(result);
            } else {
                this.state.errorMessage = result.error || 'Recognition failed';
                if (result.fallback_to_pin) {
                    this.state.showPinFallback = true;
                }
            }
        } catch (error) {
            console.error('Recognition error:', error);
            this.state.errorMessage = error.message;
            this.state.showPinFallback = this.state.settings?.fallback_pin;
        } finally {
            this.state.isProcessing = false;
        }
    }

    showSuccessNotification(result) {
        // Clear the result after showing for a few seconds
        setTimeout(() => {
            this.state.recognizedEmployee = null;
        }, this.state.settings?.kiosk_delay || 5000);
    }

    manualCapture() {
        if (!this.state.faceDetected) {
            this.state.errorMessage = 'No face detected. Please position your face in the frame.';
            return;
        }

        this.recognizeFace();
    }

    switchToPinMode() {
        this.state.showPinFallback = true;
        this.cleanup();
    }

    cleanup() {
        if (this.detectInterval) {
            clearInterval(this.detectInterval);
            this.detectInterval = null;
        }

        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }

        this.state.isStreaming = false;
    }
}

// Register as a kiosk mode option
registry.category("hr_attendance_kiosk_modes").add("face", {
    Component: FaceRecognitionKiosk,
    priority: 100,
});
