# Part of Progressive IT Solutions

{
    'name': 'Face Recognition Attendance',
    'version': '19.0.1.0.0',
    'category': 'Human Resources/Attendances',
    'summary': 'Employee attendance using face recognition',
    'description': """
Face Recognition Attendance System
====================================
This module extends the HR Attendance module to support face recognition
for employee check-in/check-out.

Features:
---------
* Face enrollment for employees
* Real-time face recognition via webcam
* Kiosk mode with face recognition
* Anti-spoofing with liveness detection
* Fallback to PIN if face recognition fails
* Face recognition settings and configuration

Technical:
----------
* Uses DeepFace library with multiple backend support
* OpenCV for webcam capture
* TensorFlow/Keras for deep learning models
    """,
    'author': 'Progressive IT Solutions',
    'website': 'https://www.progressiveitsolutions.com',
    'license': 'LGPL-3',
    'depends': ['hr_attendance', 'hr'],
    'data': [
        'security/ir.model.access.csv',
        'views/hr_employee_views.xml',
        'views/res_config_settings_views.xml',
        'views/face_kiosk_templates.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'hr_attendance_face/static/src/css/face_recognition.css',
            'hr_attendance_face/static/src/js/face_enrollment_wizard.js',
        ],
        'hr_attendance.assets_public_kiosk': [
            'hr_attendance_face/static/src/kiosk/face_kiosk.css',
            'hr_attendance_face/static/src/kiosk/face_kiosk.js',
            'hr_attendance_face/static/src/kiosk/face_kiosk.xml',
        ],
    },
    'external_dependencies': {
        'python': ['deepface', 'cv2', 'numpy', 'tensorflow'],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
}
