const fs = require('fs');
let css = fs.readFileSync('frontend/css/styles.css', 'utf8');

// The new base colors:
// Primary: #EF7B3E -> rgb(239,123,62)
// Accent: #FFD461 -> rgb(255,212,97)
// Danger: #EA5455 -> rgb(234,84,85)

css = css.replace(/rgba\(37,99,235/g, 'rgba(239,123,62'); // Primary blue -> Orange
css = css.replace(/rgba\(37,\s*99,\s*235/g, 'rgba(239, 123, 62'); 
css = css.replace(/rgba\(6,182,212/g, 'rgba(255,212,97'); // Accent cyan -> Yellow
css = css.replace(/rgba\(6,\s*182,\s*212/g, 'rgba(255, 212, 97');

// Update variables block
css = css.replace(/--primary: #2563eb;/g, '--primary: #EF7B3E;');
css = css.replace(/--primary-light: #60a5fa;/g, '--primary-light: #FF9E6D;');
css = css.replace(/--primary-dark: #1e40af;/g, '--primary-dark: #C45A22;');
css = css.replace(/--primary-glow: rgba\(37, 99, 235, 0.25\);/g, '--primary-glow: rgba(239, 123, 62, 0.25);');

css = css.replace(/--accent: #06b6d4;/g, '--accent: #FFD461;');
css = css.replace(/--accent-glow: rgba\(6, 182, 212, 0.20\);/g, '--accent-glow: rgba(255, 212, 97, 0.20);');

css = css.replace(/--danger: #ef4444;/g, '--danger: #EA5455;');
css = css.replace(/--danger-glow: rgba\(239, 68, 68, 0.2\);/g, '--danger-glow: rgba(234, 84, 85, 0.2);');

// Dark Surfaces based on #2C4059
css = css.replace(/--bg0: #050b18;/g, '--bg0: #121e2b;');
css = css.replace(/--bg1: #0a1628;/g, '--bg1: #1d2d40;');
css = css.replace(/--bg2: #111d35;/g, '--bg2: #2C4059;');
css = css.replace(/--bg3: #1a2744;/g, '--bg3: #385273;');
css = css.replace(/--bg4: #243454;/g, '--bg4: #47668e;');
css = css.replace(/--glass-bg: rgba\(11, 22, 40, 0.65\);/g, '--glass-bg: rgba(44, 64, 89, 0.65);');

// Gradient replacements
css = css.replace(/--grad-primary: linear-gradient\(135deg, #3b82f6 0%, #1d4ed8 100%\);/g, '--grad-primary: linear-gradient(135deg, #FFD461 0%, #EF7B3E 100%);');
css = css.replace(/--grad-accent: linear-gradient\(135deg, #06b6d4, #2563eb\);/g, '--grad-accent: linear-gradient(135deg, #FFD461, #EA5455);');
css = css.replace(/--grad-mesh: linear-gradient\(135deg, #0a1628 0%, #111d35 40%, #0f1d36 100%\);/g, '--grad-mesh: linear-gradient(135deg, #1d2d40 0%, #2C4059 40%, #121e2b 100%);');

// Light theme overrides
const lightThemeRe = /\[data-theme="light"\] \{[\s\S]*?\}/;
const newLightTheme = `[data-theme="light"] {
    --bg0: #fbf8f5; --bg1: #ffffff; --bg2: #fcf4eb;
    --bg3: #f5ebd9; --bg4: #ecd9bd;
    --text1: #2C4059; --text2: #4a5c73; --text3: #758aa3;
    --glass-bg: rgba(255,255,255,.85);
    --glass-border: rgba(239, 123, 62, 0.15);
    --grad-mesh: linear-gradient(135deg, #fbf8f5 0%, #fff7eb 100%);
}`;
css = css.replace(lightThemeRe, newLightTheme);

// Other hex color replacements
css = css.replace(/#3b82f6/gi, '#EF7B3E'); // info / primary shades
css = css.replace(/#10b981/gi, '#10b981'); // success leave alone
css = css.replace(/#f59e0b/gi, '#FFD461'); // warning to accent
css = css.replace(/#ef4444/gi, '#EA5455'); // old danger to new danger
css = css.replace(/#0a1628/gi, '#1d2d40');
css = css.replace(/#111d35/gi, '#2C4059');
css = css.replace(/#0f1d36/gi, '#121e2b');

fs.writeFileSync('frontend/css/styles.css', css, 'utf8');
console.log('Styles modified successfully!');
