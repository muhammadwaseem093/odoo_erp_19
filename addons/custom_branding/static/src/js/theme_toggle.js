/** @odoo-module **/

import { Component, useState, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";

/**
 * Theme Toggle Component
 * Adds a dark/light mode toggle button to the systray (navbar)
 */
export class ThemeToggle extends Component {
    static template = "custom_branding.ThemeToggle";
    static props = {};

    setup() {
        this.state = useState({
            isDarkMode: this.getStoredTheme() === "dark"
        });
        
        onMounted(() => {
            // Apply theme on component mount
            this.applyTheme(this.state.isDarkMode ? "dark" : "light");
        });
    }

    /**
     * Get stored theme preference from localStorage
     */
    getStoredTheme() {
        return localStorage.getItem("progressive_theme") || "light";
    }

    /**
     * Store theme preference in localStorage
     */
    storeTheme(theme) {
        localStorage.setItem("progressive_theme", theme);
    }

    /**
     * Apply theme to document
     */
    applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        
        // Also set on body for compatibility
        if (theme === "dark") {
            document.body.classList.add("dark-mode");
            document.body.classList.remove("light-mode");
        } else {
            document.body.classList.add("light-mode");
            document.body.classList.remove("dark-mode");
        }
    }

    /**
     * Toggle between dark and light mode
     */
    toggleTheme() {
        this.state.isDarkMode = !this.state.isDarkMode;
        const newTheme = this.state.isDarkMode ? "dark" : "light";
        
        this.storeTheme(newTheme);
        this.applyTheme(newTheme);
    }

    /**
     * Get icon class based on current theme
     * Using FontAwesome 4 icons (fa fa-*)
     */
    get iconClass() {
        // Show sun when dark (to switch to light), moon when light (to switch to dark)
        return this.state.isDarkMode ? "fa fa-sun-o" : "fa fa-moon-o";
    }

    /**
     * Get tooltip text
     */
    get tooltipText() {
        return this.state.isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode";
    }
}

// Register the component in the systray (right side of navbar)
// sequence: 5 puts it near the beginning (after user menu)
registry.category("systray").add(
    "custom_branding.ThemeToggle",
    { Component: ThemeToggle },
    { sequence: 5 }
);
