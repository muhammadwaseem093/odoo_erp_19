# Part of Progressive IT Solutions

import base64
import json
import logging
import numpy as np
from io import BytesIO

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError

_logger = logging.getLogger(__name__)

try:
    from deepface import DeepFace
    import cv2
    FACE_RECOGNITION_AVAILABLE = True
except Exception as e:
    FACE_RECOGNITION_AVAILABLE = False
    _logger.warning("Face recognition libraries not available: %s", str(e))


class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    # Face Recognition Fields
    face_encoding = fields.Text(
        string='Face Encoding',
        help='Stored face encoding data for recognition',
        groups='hr.group_hr_user'
    )
    face_image_ids = fields.One2many(
        'hr.employee.face.image',
        'employee_id',
        string='Face Images',
        groups='hr.group_hr_user'
    )
    face_enrolled = fields.Boolean(
        string='Face Enrolled',
        compute='_compute_face_enrolled',
        store=True,
        help='Indicates if the employee has enrolled face for recognition'
    )
    face_enrollment_date = fields.Datetime(
        string='Face Enrollment Date',
        groups='hr.group_hr_user'
    )
    face_recognition_enabled = fields.Boolean(
        string='Face Recognition Enabled',
        default=True,
        help='Enable face recognition for this employee'
    )

    @api.depends('face_encoding', 'face_image_ids')
    def _compute_face_enrolled(self):
        for employee in self:
            employee.face_enrolled = bool(employee.face_encoding) or bool(employee.face_image_ids)

    def action_enroll_face(self):
        """Open face enrollment wizard"""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Enroll Face'),
            'res_model': 'hr.employee.face.enrollment.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_employee_id': self.id},
        }

    def action_clear_face_data(self):
        """Clear all face recognition data for this employee"""
        self.ensure_one()
        self.write({
            'face_encoding': False,
            'face_enrollment_date': False,
        })
        self.face_image_ids.unlink()
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Face Data Cleared'),
                'message': _('Face recognition data has been cleared for %s') % self.name,
                'type': 'success',
            }
        }

    def _generate_face_encoding(self, image_base64):
        """Generate face encoding from base64 image"""
        if not FACE_RECOGNITION_AVAILABLE:
            raise UserError(_('Face recognition libraries are not installed.'))

        try:
            # Decode base64 image
            image_data = base64.b64decode(image_base64)
            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                raise UserError(_('Could not decode the image.'))

            # Get face embedding using DeepFace
            embedding = DeepFace.represent(
                img_path=img,
                model_name='Facenet512',
                enforce_detection=True,
                detector_backend='opencv'
            )

            if embedding and len(embedding) > 0:
                return json.dumps(embedding[0]['embedding'])
            else:
                raise UserError(_('No face detected in the image.'))

        except Exception as e:
            _logger.error(f"Face encoding error: {str(e)}")
            raise UserError(_('Error generating face encoding: %s') % str(e))

    def _verify_face(self, image_base64, threshold=0.6):
        """Verify if the given image matches the enrolled face"""
        self.ensure_one()
        
        if not FACE_RECOGNITION_AVAILABLE:
            return False, _('Face recognition libraries not available')

        if not self.face_encoding:
            return False, _('No face enrolled for this employee')

        try:
            # Decode the input image
            image_data = base64.b64decode(image_base64)
            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                return False, _('Could not decode the image')

            # Get embedding of the input image
            embedding = DeepFace.represent(
                img_path=img,
                model_name='Facenet512',
                enforce_detection=True,
                detector_backend='opencv'
            )

            if not embedding or len(embedding) == 0:
                return False, _('No face detected in the image')

            input_encoding = np.array(embedding[0]['embedding'])
            stored_encoding = np.array(json.loads(self.face_encoding))

            # Calculate cosine similarity
            similarity = np.dot(input_encoding, stored_encoding) / (
                np.linalg.norm(input_encoding) * np.linalg.norm(stored_encoding)
            )

            if similarity >= threshold:
                return True, _('Face verified successfully')
            else:
                return False, _('Face does not match')

        except Exception as e:
            _logger.error(f"Face verification error: {str(e)}")
            return False, str(e)


class HrEmployeeFaceImage(models.Model):
    _name = 'hr.employee.face.image'
    _description = 'Employee Face Image'

    employee_id = fields.Many2one(
        'hr.employee',
        string='Employee',
        required=True,
        ondelete='cascade'
    )
    image = fields.Binary(
        string='Face Image',
        required=True,
        attachment=True
    )
    image_preview = fields.Binary(
        string='Preview',
        related='image',
        readonly=True
    )
    direction = fields.Selection([
        ('front', 'Front'),
        ('left', 'Left'),
        ('right', 'Right'),
        ('up', 'Up'),
        ('down', 'Down'),
    ], string='Direction', default='front')
    capture_date = fields.Datetime(
        string='Capture Date',
        default=fields.Datetime.now
    )
    is_primary = fields.Boolean(
        string='Primary Image',
        default=False
    )


class HrEmployeeFaceEnrollmentWizard(models.TransientModel):
    _name = 'hr.employee.face.enrollment.wizard'
    _description = 'Face Enrollment Wizard'

    employee_id = fields.Many2one(
        'hr.employee',
        string='Employee',
        required=True
    )
    face_image = fields.Binary(
        string='Captured Face Image',
        help='Image captured from webcam'
    )
    # Multi-step capture images
    face_front = fields.Binary(string='Front Face')
    face_left = fields.Binary(string='Left Turn')
    face_right = fields.Binary(string='Right Turn')
    face_up = fields.Binary(string='Look Up')
    face_down = fields.Binary(string='Look Down')
    
    current_step = fields.Selection([
        ('front', 'Look Straight'),
        ('left', 'Turn Left'),
        ('right', 'Turn Right'),
        ('up', 'Look Up'),
        ('down', 'Look Down'),
        ('complete', 'Complete'),
    ], default='front', string='Current Step')
    
    enrollment_status = fields.Selection([
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
    ], default='pending', string='Status')
    message = fields.Text(string='Message')

    def action_save_step(self):
        """Save the current step image and advance to next step"""
        self.ensure_one()
        
        if not self.face_image:
            raise UserError(_('Please capture a face image first.'))
        
        step_sequence = ['front', 'left', 'right', 'up', 'down', 'complete']
        current_idx = step_sequence.index(self.current_step)
        
        # Save current step image
        step_field = f'face_{self.current_step}'
        self.write({step_field: self.face_image, 'face_image': False})
        
        # Move to next step
        next_step = step_sequence[current_idx + 1] if current_idx < len(step_sequence) - 1 else 'complete'
        self.write({'current_step': next_step})
        
        if next_step == 'complete':
            return self.action_enroll()
        
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'hr.employee.face.enrollment.wizard',
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }

    def action_enroll(self):
        """Process face enrollment with all captured images"""
        self.ensure_one()
        
        # Check if we have at least the front image
        if not self.face_front and not self.face_image:
            raise UserError(_('Please capture at least a front face image.'))

        try:
            # Use front image or the single captured image
            primary_image = self.face_front or self.face_image
            
            # Clear existing face images for this employee
            self.env['hr.employee.face.image'].search([
                ('employee_id', '=', self.employee_id.id)
            ]).unlink()

            # Save all captured face images
            face_images = [
                ('front', self.face_front, True),
                ('left', self.face_left, False),
                ('right', self.face_right, False),
                ('up', self.face_up, False),
                ('down', self.face_down, False),
            ]
            
            for direction, image, is_primary in face_images:
                if image:
                    self.env['hr.employee.face.image'].create({
                        'employee_id': self.employee_id.id,
                        'image': image,
                        'is_primary': is_primary,
                        'direction': direction,
                    })

            # Try to generate face encoding (optional - requires DeepFace)
            encoding = None
            try:
                if FACE_RECOGNITION_AVAILABLE:
                    encoding = self.employee_id._generate_face_encoding(primary_image)
            except Exception as enc_error:
                _logger.warning(f"Face encoding skipped: {str(enc_error)}")
            
            # Save face data
            update_vals = {
                'face_enrollment_date': fields.Datetime.now(),
            }
            if encoding:
                update_vals['face_encoding'] = encoding
            
            self.employee_id.write(update_vals)

            self.write({
                'enrollment_status': 'success',
                'message': _('Face enrolled successfully!')
            })

            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Face Enrollment'),
                    'message': _('Face enrolled successfully for %s') % self.employee_id.name,
                    'type': 'success',
                    'sticky': False,
                }
            }

        except Exception as e:
            self.write({
                'enrollment_status': 'failed',
                'message': str(e)
            })
            raise UserError(_('Face enrollment failed: %s') % str(e))
