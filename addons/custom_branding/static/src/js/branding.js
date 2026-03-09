/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { WebClient } from "@web/webclient/webclient";

// Company name constant
const COMPANY_NAME = "Progressive IT Solutions";

// Patch WebClient to change title
patch(WebClient.prototype, {
    setup() {
        super.setup();
        // Override document title
        this._updateTitle();
    },
    
    _updateTitle() {
        const title = document.title;
        if (title.includes("Odoo")) {
            document.title = title.replace(/Odoo/gi, COMPANY_NAME);
        }
    }
});

// Function to replace Odoo text throughout the page
function replaceOdooText() {
    // Title
    if (document.title.toLowerCase().includes("odoo")) {
        document.title = document.title.replace(/odoo/gi, COMPANY_NAME);
    }
    
    // Meta tags
    const metaTags = document.querySelectorAll('meta[content*="Odoo"], meta[content*="odoo"]');
    metaTags.forEach(tag => {
        tag.content = tag.content.replace(/odoo/gi, COMPANY_NAME);
    });
    
    // Settings page About section - specific replacement for version header
    const userHeadings = document.querySelectorAll('.user-heading h3');
    userHeadings.forEach(h3 => {
        if (h3.textContent.includes('Odoo') && h3.textContent.includes('Community Edition')) {
            // Extract version number
            const versionMatch = h3.textContent.match(/(\d+\.\d+)/);
            const version = versionMatch ? versionMatch[1] : '19.0';
            h3.innerHTML = COMPANY_NAME + ' ' + version;
        }
    });
    
    // Settings page About section - specific replacement for copyright
    const currentYear = new Date().getFullYear();
    const copyrightElements = document.querySelectorAll('.o_web_settings_compact_subtitle small, #settings small');
    copyrightElements.forEach(el => {
        if (el.textContent.includes('Copyright') && el.textContent.includes('Odoo S.A.')) {
            el.innerHTML = 'Copyright © ' + currentYear + ' ' + COMPANY_NAME;
        }
    });
    
    // Replace text in specific elements
    const textElements = document.querySelectorAll('span, a, p, h1, h2, h3, h4, h5, h6, label, button, div');
    textElements.forEach(el => {
        // Only replace direct text content, not nested elements
        if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
            if (el.textContent.match(/\bodoo\b/i)) {
                el.textContent = el.textContent.replace(/\bodoo\b/gi, COMPANY_NAME);
            }
        }
    });
    
    // Replace in placeholders
    const inputs = document.querySelectorAll('input[placeholder*="Odoo"], input[placeholder*="odoo"]');
    inputs.forEach(input => {
        input.placeholder = input.placeholder.replace(/odoo/gi, COMPANY_NAME);
    });
    
    // Replace "Powered by Odoo" specifically
    const poweredByElements = document.querySelectorAll('.o_brand_promotion, [class*="powered"]');
    poweredByElements.forEach(el => {
        if (el.innerHTML.match(/odoo/i)) {
            el.innerHTML = el.innerHTML.replace(/odoo/gi, COMPANY_NAME);
        }
    });
}

// Override any Odoo text in the DOM after load
document.addEventListener("DOMContentLoaded", function() {
    replaceOdooText();
    
    // Observe DOM changes for dynamic content
    const observer = new MutationObserver((mutations) => {
        let shouldReplace = false;
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldReplace = true;
            }
        });
        if (shouldReplace) {
            requestAnimationFrame(replaceOdooText);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});

// Also run on window load to catch dynamically rendered content
window.addEventListener("load", replaceOdooText);

// Run periodically for first few seconds to catch late-loaded content
let runCount = 0;
const interval = setInterval(() => {
    replaceOdooText();
    runCount++;
    if (runCount >= 10) {
        clearInterval(interval);
    }
}, 500);

// Export company name for use in other modules
export const companyName = COMPANY_NAME;
