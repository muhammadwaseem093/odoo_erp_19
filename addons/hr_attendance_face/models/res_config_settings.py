# Part of Progressive IT Solutions

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # Attendance Mode Settings
    attendance_mode_biometric = fields.Boolean(
        related='company_id.attendance_mode_biometric',
        readonly=False
    )
    attendance_mode_face_recognition = fields.Boolean(
        related='company_id.attendance_mode_face_recognition',
        readonly=False
    )
    attendance_mode_manual = fields.Boolean(
        related='company_id.attendance_mode_manual',
        readonly=False
    )
    attendance_mode_pin = fields.Boolean(
        related='company_id.attendance_mode_pin',
        readonly=False
    )
    attendance_mode_qr_code = fields.Boolean(
        related='company_id.attendance_mode_qr_code',
        readonly=False
    )

    # Face Recognition Settings
    face_recognition_enabled = fields.Boolean(
        related='company_id.face_recognition_enabled',
        readonly=False
    )
    face_recognition_threshold = fields.Float(
        related='company_id.face_recognition_threshold',
        readonly=False
    )
    face_recognition_model = fields.Selection(
        related='company_id.face_recognition_model',
        readonly=False
    )
    face_detector_backend = fields.Selection(
        related='company_id.face_detector_backend',
        readonly=False
    )
    face_liveness_detection = fields.Boolean(
        related='company_id.face_liveness_detection',
        readonly=False
    )
    face_recognition_fallback_pin = fields.Boolean(
        related='company_id.face_recognition_fallback_pin',
        readonly=False
    )
    face_kiosk_camera_index = fields.Integer(
        related='company_id.face_kiosk_camera_index',
        readonly=False
    )
    face_capture_quality = fields.Selection(
        related='company_id.face_capture_quality',
        readonly=False
    )
    face_auto_capture = fields.Boolean(
        related='company_id.face_auto_capture',
        readonly=False
    )
    face_auto_capture_delay = fields.Integer(
        related='company_id.face_auto_capture_delay',
        readonly=False
    )
