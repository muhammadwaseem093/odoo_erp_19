# Part of Progressive IT Solutions

import base64
import json
import logging

from odoo import http, _
from odoo.http import request
from odoo.addons.hr_attendance.controllers.main import HrAttendance

_logger = logging.getLogger(__name__)

try:
    from deepface import DeepFace
    import cv2
    import numpy as np
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False


class HrAttendanceFace(HrAttendance):
    """Extend HR Attendance controller with face recognition capabilities"""

    @http.route('/hr_attendance_face/store_captured_image', type='json', auth='user')
    def store_captured_image(self, wizard_id, image_data, step=None):
        """Store captured image in wizard record"""
        try:
            wizard = request.env['hr.employee.face.enrollment.wizard'].browse(int(wizard_id))
            if wizard.exists():
                # Remove data URL prefix if present
                if image_data and ',' in image_data:
                    image_data = image_data.split(',')[1]
                
                if step:
                    # Multi-step enrollment - save to specific field
                    step_field = f'face_{step}'
                    wizard.write({step_field: image_data})
                else:
                    wizard.write({'face_image': image_data})
                
                return {'success': True, 'wizard_id': wizard.id}
            return {'success': False, 'error': 'Wizard not found'}
        except Exception as e:
            _logger.error(f"Store image error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    @http.route('/hr_attendance_face/complete_enrollment', type='json', auth='user')
    def complete_enrollment(self, wizard_id=None, employee_id=None, images=None):
        """Complete face enrollment with all captured images"""
        try:
            if not images:
                return {'success': False, 'error': 'No images provided'}
            
            # Try to get wizard by ID, or create new one if we have employee_id
            wizard = None
            if wizard_id:
                wizard = request.env['hr.employee.face.enrollment.wizard'].browse(int(wizard_id))
                if not wizard.exists():
                    wizard = None
            
            if not wizard and employee_id:
                # Create a new wizard record
                wizard = request.env['hr.employee.face.enrollment.wizard'].create({
                    'employee_id': int(employee_id)
                })
                _logger.info(f"Created wizard {wizard.id} for employee {employee_id}")
            
            if not wizard:
                return {'success': False, 'error': 'Could not find or create wizard. Please provide employee_id.'}
            
            # Process all images
            for step, image_data in images.items():
                if image_data:
                    # Remove data URL prefix
                    if ',' in image_data:
                        image_data = image_data.split(',')[1]
                    step_field = f'face_{step}'
                    if hasattr(wizard, step_field):
                        wizard.write({step_field: image_data})
            
            # Set main face_image to front if available
            if images.get('front'):
                front_data = images['front']
                if ',' in front_data:
                    front_data = front_data.split(',')[1]
                wizard.write({'face_image': front_data})
            
            # Trigger enrollment
            result = wizard.action_enroll()
            
            return {
                'success': True,
                'message': 'Face enrolled successfully!',
                'result': result
            }
            
        except Exception as e:
            _logger.error(f"Complete enrollment error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/hr_attendance_face/check_availability', type='json', auth='public')
    def check_face_recognition_availability(self):
        """Check if face recognition is available"""
        return {
            'available': FACE_RECOGNITION_AVAILABLE,
            'message': _('Face recognition is available') if FACE_RECOGNITION_AVAILABLE else _('Face recognition libraries not installed')
        }

    @http.route('/hr_attendance_face/get_settings', type='json', auth='public')
    def get_face_recognition_settings(self, token):
        """Get face recognition settings for kiosk"""
        company = self._get_company(token)
        if not company:
            return {'error': _('Invalid token')}

        return {
            'enabled': company.face_recognition_enabled,
            'threshold': company.face_recognition_threshold,
            'model': company.face_recognition_model,
            'detector': company.face_detector_backend,
            'liveness_detection': company.face_liveness_detection,
            'fallback_pin': company.face_recognition_fallback_pin,
            'camera_index': company.face_kiosk_camera_index,
            'capture_quality': company.face_capture_quality,
            'auto_capture': company.face_auto_capture,
            'auto_capture_delay': company.face_auto_capture_delay,
        }

    @http.route('/hr_attendance_face/detect_face', type='json', auth='public')
    def detect_face(self, image_data):
        """Detect if there's a face in the image"""
        if not FACE_RECOGNITION_AVAILABLE:
            return {'error': _('Face recognition not available')}

        try:
            # Remove data URL prefix if present
            if ',' in image_data:
                image_data = image_data.split(',')[1]

            # Decode base64 image
            image_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                return {'detected': False, 'error': _('Invalid image')}

            # Try to detect faces using OpenCV
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)

            if len(faces) > 0:
                x, y, w, h = faces[0]
                return {
                    'detected': True,
                    'face_count': len(faces),
                    'face_location': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
                }
            else:
                return {'detected': False, 'face_count': 0}

        except Exception as e:
            _logger.error(f"Face detection error: {str(e)}")
            return {'detected': False, 'error': str(e)}

    @http.route('/hr_attendance_face/recognize', type='json', auth='public')
    def recognize_face(self, token, image_data):
        """Recognize employee from face image and perform attendance action"""
        if not FACE_RECOGNITION_AVAILABLE:
            return {'error': _('Face recognition not available')}

        company = self._get_company(token)
        if not company:
            return {'error': _('Invalid token')}

        if not company.face_recognition_enabled:
            return {'error': _('Face recognition is disabled for this company')}

        try:
            # Remove data URL prefix if present
            if ',' in image_data:
                image_data = image_data.split(',')[1]

            # Decode base64 image
            image_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                return {'success': False, 'error': _('Invalid image')}

            # Get face embedding from input image
            try:
                input_embedding = DeepFace.represent(
                    img_path=img,
                    model_name=company.face_recognition_model,
                    enforce_detection=True,
                    detector_backend=company.face_detector_backend
                )
            except Exception as e:
                return {'success': False, 'error': _('No face detected in image')}

            if not input_embedding or len(input_embedding) == 0:
                return {'success': False, 'error': _('No face detected in image')}

            input_encoding = np.array(input_embedding[0]['embedding'])

            # Search for matching employee
            employees = request.env['hr.employee'].sudo().search([
                ('company_id', '=', company.id),
                ('face_encoding', '!=', False),
                ('face_recognition_enabled', '=', True),
            ])

            best_match = None
            best_similarity = 0
            threshold = company.face_recognition_threshold

            for employee in employees:
                try:
                    stored_encoding = np.array(json.loads(employee.face_encoding))
                    
                    # Calculate cosine similarity
                    similarity = np.dot(input_encoding, stored_encoding) / (
                        np.linalg.norm(input_encoding) * np.linalg.norm(stored_encoding)
                    )

                    if similarity > best_similarity and similarity >= threshold:
                        best_similarity = similarity
                        best_match = employee

                except Exception as e:
                    _logger.warning(f"Error comparing with employee {employee.id}: {str(e)}")
                    continue

            if best_match:
                # Perform attendance action
                geo_ip_response = self._get_geoip_response(
                    mode='face_kiosk',
                    device_tracking_enabled=company.attendance_device_tracking
                )
                best_match._attendance_action_change(geo_ip_response)

                return {
                    'success': True,
                    'employee_id': best_match.id,
                    'employee_name': best_match.name,
                    'similarity': float(best_similarity),
                    **self._get_employee_info_response(best_match)
                }
            else:
                return {
                    'success': False,
                    'error': _('No matching employee found'),
                    'fallback_to_pin': company.face_recognition_fallback_pin
                }

        except Exception as e:
            _logger.error(f"Face recognition error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/hr_attendance_face/verify', type='json', auth='public')
    def verify_face(self, token, employee_id, image_data):
        """Verify face against a specific employee"""
        if not FACE_RECOGNITION_AVAILABLE:
            return {'error': _('Face recognition not available')}

        company = self._get_company(token)
        if not company:
            return {'error': _('Invalid token')}

        try:
            # Remove data URL prefix if present
            if ',' in image_data:
                image_data = image_data.split(',')[1]

            employee = request.env['hr.employee'].sudo().browse(employee_id)
            if not employee or employee.company_id != company:
                return {'success': False, 'error': _('Employee not found')}

            verified, message = employee._verify_face(image_data, company.face_recognition_threshold)

            if verified:
                # Perform attendance action
                geo_ip_response = self._get_geoip_response(
                    mode='face_kiosk',
                    device_tracking_enabled=company.attendance_device_tracking
                )
                employee._attendance_action_change(geo_ip_response)

                return {
                    'success': True,
                    'verified': True,
                    'message': message,
                    **self._get_employee_info_response(employee)
                }
            else:
                return {
                    'success': False,
                    'verified': False,
                    'message': message,
                    'fallback_to_pin': company.face_recognition_fallback_pin
                }

        except Exception as e:
            _logger.error(f"Face verification error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/hr_attendance_face/enroll', type='json', auth='user')
    def enroll_face(self, employee_id, image_data):
        """Enroll face for an employee (requires user authentication)"""
        if not FACE_RECOGNITION_AVAILABLE:
            return {'error': _('Face recognition not available')}

        try:
            employee = request.env['hr.employee'].browse(employee_id)
            if not employee.exists():
                return {'success': False, 'error': _('Employee not found')}

            # Remove data URL prefix if present
            if ',' in image_data:
                image_data = image_data.split(',')[1]

            # Generate encoding
            encoding = employee._generate_face_encoding(image_data)

            # Save face data
            employee.write({
                'face_encoding': encoding,
                'face_enrollment_date': request.env['fields'].Datetime.now(),
            })

            # Save face image
            request.env['hr.employee.face.image'].create({
                'employee_id': employee.id,
                'image': image_data,
                'is_primary': True,
            })

            return {
                'success': True,
                'message': _('Face enrolled successfully')
            }

        except Exception as e:
            _logger.error(f"Face enrollment error: {str(e)}")
            return {'success': False, 'error': str(e)}

    @http.route('/hr_attendance_face/get_enrolled_employees', type='json', auth='public')
    def get_enrolled_employees(self, token):
        """Get list of employees with enrolled faces"""
        company = self._get_company(token)
        if not company:
            return {'error': _('Invalid token')}

        employees = request.env['hr.employee'].sudo().search([
            ('company_id', '=', company.id),
            ('face_enrolled', '=', True),
            ('face_recognition_enabled', '=', True),
        ])

        return {
            'employees': [{
                'id': emp.id,
                'name': emp.name,
                'job_title': emp.job_id.name if emp.job_id else '',
                'department': emp.department_id.name if emp.department_id else '',
            } for emp in employees]
        }
