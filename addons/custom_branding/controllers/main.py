# Part of Progressive IT Solutions
# Custom URL routing for PitS branding

from odoo import http
from odoo.http import request
from odoo.addons.web.controllers.home import Home


class PitSBrandingController(Home):
    """
    Controller to add /odoo as URL alias for /PitS (backwards compatibility)
    This allows using http://localhost:8069/odoo/employees which redirects to /PitS/employees
    """

    @http.route(['/odoo', '/odoo/<path:subpath>'], type='http', auth="none")
    def odoo_backwards_compat(self, subpath=None, **kw):
        """
        Handle /odoo URLs by redirecting to /PitS equivalent
        This maintains backwards compatibility
        """
        if subpath:
            return request.redirect(f'/PitS/{subpath}', code=307)
        return request.redirect('/PitS', code=307)
