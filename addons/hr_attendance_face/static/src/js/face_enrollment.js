/** @odoo-module **/

import { Component, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

/**
 * Face Enrollment Component for capturing employee face
 */
export class FaceEnrollmentWidget extends Component {
    static template = "hr_attendance_face.FaceEnrollmentWidget";
    static props = {
        record: Object,
    };

    setup() {
        this.rpc = useService("rpc");
        this.notification = useService("notification");
        
        this.state = useState({
            isStreaming: false,
            hasCapture: false,
            capturedImage: null,
            faceDetected: false,
            isProcessing: false,
            errorMessage: null,
        });

        this.videoStream = null;
        this.videoElement = null;
        this.canvasElement = null;
        this.detectInterval = null;

        onMounted(() => this.startCamera());
        onWillUnmount(() => this.stopCamera());
    }

    async startCamera() {
        try {
            // Request camera access
            this.videoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });

            this.videoElement = document.getElementById('face-video');
            if (this.videoElement) {
                this.videoElement.srcObject = this.videoStream;
                this.videoElement.play();
                this.state.isStreaming = true;

                // Start face detection interval
                this.detectInterval = setInterval(() => this.detectFace(), 1000);
            }
        } catch (error) {
            console.error('Camera access error:', error);
            this.state.errorMessage = 'Could not access camera. Please ensure camera permissions are granted.';
            this.notification.add(this.state.errorMessage, { type: 'danger' });
        }
    }

    stopCamera() {
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

    async detectFace() {
        if (!this.state.isStreaming || this.state.hasCapture) return;

        try {
            const imageData = this.captureFrame();
            if (!imageData) return;

            const result = await this.rpc('/hr_attendance_face/detect_face', {
                image_data: imageData
            });

            this.state.faceDetected = result.detected;

            // Update face detection indicator
            const indicator = document.getElementById('face-indicator');
            if (indicator) {
                indicator.className = result.detected ? 
                    'face-indicator face-detected' : 
                    'face-indicator';
            }
        } catch (error) {
            console.error('Face detection error:', error);
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

    capture() {
        if (!this.state.isStreaming) return;

        const imageData = this.captureFrame();
        if (imageData) {
            this.state.capturedImage = imageData;
            this.state.hasCapture = true;
            
            // Show captured image
            const capturedImg = document.getElementById('captured-image');
            if (capturedImg) {
                capturedImg.src = imageData;
            }
        }
    }

    retake() {
        this.state.hasCapture = false;
        this.state.capturedImage = null;
        this.state.faceDetected = false;
    }

    async enroll() {
        if (!this.state.capturedImage) {
            this.notification.add('Please capture an image first', { type: 'warning' });
            return;
        }

        this.state.isProcessing = true;

        try {
            const result = await this.rpc('/hr_attendance_face/enroll', {
                employee_id: this.props.record.resId,
                image_data: this.state.capturedImage
            });

            if (result.success) {
                this.notification.add('Face enrolled successfully!', { type: 'success' });
                // Reload the record to show updated face enrollment status
                this.props.record.load();
            } else {
                this.notification.add(result.error || 'Enrollment failed', { type: 'danger' });
            }
        } catch (error) {
            console.error('Enrollment error:', error);
            this.notification.add('Error during enrollment: ' + error.message, { type: 'danger' });
        } finally {
            this.state.isProcessing = false;
        }
    }
}

// Register the component
registry.category("fields").add("face_enrollment", {
    component: FaceEnrollmentWidget,
});
