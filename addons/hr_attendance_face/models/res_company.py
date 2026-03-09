# Part of Progressive IT Solutions

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    # Attendance Mode Settings
    attendance_mode_biometric = fields.Boolean(
        string='Biometric Attendance',
        default=False,
        help='Enable biometric (fingerprint/RFID) attendance mode'
    )
    attendance_mode_face_recognition = fields.Boolean(
        string='Face Recognition Attendance',
        default=True,
        help='Enable face recognition attendance mode'
    )
    attendance_mode_manual = fields.Boolean(
        string='Manual Attendance',
        default=True,
        help='Enable manual check-in/check-out attendance mode'
    )
    attendance_mode_pin = fields.Boolean(
        string='PIN Attendance',
        default=False,
        help='Enable PIN-based attendance mode'
    )
    attendance_mode_qr_code = fields.Boolean(
        string='QR Code Attendance',
        default=False,
        help='Enable QR code scan attendance mode'
    )

    # Face Recognition Settings
    face_recognition_enabled = fields.Boolean(
        string='Enable Face Recognition',
        default=True,
        help='Enable face recognition for attendance'
    )
    face_recognition_threshold = fields.Float(
        string='Recognition Threshold',
        default=0.6,
        help='Minimum similarity score (0-1) for face verification. Higher value = stricter matching.'
    )
    face_recognition_model = fields.Selection([
        ('Facenet512', 'FaceNet-512 (Recommended)'),
        ('Facenet', 'FaceNet'),
        ('VGG-Face', 'VGG-Face'),
        ('ArcFace', 'ArcFace'),
        ('OpenFace', 'OpenFace'),
        ('DeepFace', 'DeepFace'),
    ], string='Recognition Model', default='Facenet512',
        help='Deep learning model for face recognition')
    face_detector_backend = fields.Selection([
        ('opencv', 'OpenCV (Fast)'),
        ('mtcnn', 'MTCNN (Accurate)'),
        ('retinaface', 'RetinaFace (Most Accurate)'),
        ('ssd', 'SSD'),
        ('mediapipe', 'MediaPipe'),
    ], string='Face Detector', default='opencv',
        help='Backend for face detection')
    face_liveness_detection = fields.Boolean(
        string='Liveness Detection',
        default=False,
        help='Enable anti-spoofing with liveness detection (blink detection)'
    )
    face_recognition_fallback_pin = fields.Boolean(
        string='PIN Fallback',
        default=True,
        help='Allow PIN entry if face recognition fails'
    )
    face_kiosk_camera_index = fields.Integer(
        string='Camera Index',
        default=0,
        help='Camera device index (0 for default camera)'
    )
    face_capture_quality = fields.Selection([
        ('low', 'Low (320x240)'),
        ('medium', 'Medium (640x480)'),
        ('high', 'High (1280x720)'),
    ], string='Capture Quality', default='medium',
        help='Webcam capture resolution')
    face_auto_capture = fields.Boolean(
        string='Auto Capture',
        default=True,
        help='Automatically capture when face is detected'
    )
    face_auto_capture_delay = fields.Integer(
        string='Auto Capture Delay (ms)',
        default=2000,
        help='Delay before auto-capture after face detection'
    )
