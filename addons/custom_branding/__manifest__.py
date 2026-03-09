{
    'name': 'Progressive IT Solutions Branding',
    'version': '1.1.0',
    'category': 'Hidden',
    'summary': 'Complete rebranding to Progressive IT Solutions with Dark Mode',
    'description': """
        Progressive IT Solutions - Custom Branding Module
        =================================================
        This module removes all Odoo branding and replaces it with 
        Progressive IT Solutions branding throughout the system.
        
        Features:
        - Custom logo on login and backend
        - Custom browser title and favicon
        - Custom footer copyright
        - Dark/Light mode toggle
        - Custom fonts and colors
    """,
    'author': 'Progressive IT Solutions',
    'website': 'https://www.progressiveitsolutions.com',
    'license': 'LGPL-3',
    'depends': ['web', 'mail'],
    'data': [
        'views/custom_branding_templates.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_branding/static/src/scss/custom_branding.css',
            'custom_branding/static/src/scss/dark_mode.css',
            'custom_branding/static/src/js/branding.js',
            'custom_branding/static/src/js/theme_toggle.js',
            'custom_branding/static/src/xml/theme_toggle.xml',
            'custom_branding/static/src/xml/res_config_edition.xml',
        ],
        'web.assets_frontend': [
            'custom_branding/static/src/scss/custom_branding.css',
            'custom_branding/static/src/scss/dark_mode.css',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
}  