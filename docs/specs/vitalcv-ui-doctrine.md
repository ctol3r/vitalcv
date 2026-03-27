# VitalCV UI Doctrine

## 1. Tone & Palette
- **Calm Infrastructure Tone:** The UI must feel like essential, high-reliability infrastructure. It should inspire the same confidence as a banking terminal or a medical record system.
- **Palette restriction:** Strict black and white (`#000000` to `#FFFFFF`) with grayscale used exclusively for structural hierarchy and borders.
- **Color Discipline:** Semantic colors (red, green, amber, blue) are reserved **EXCLUSIVELY** for status alerts, verification states, and critical system feedback. Never use color for branding, decoration, or primary CTA buttons (unless specifically highlighting a destructive/constructive action).

## 2. Layout & Focus
- **One Dominant Idea Per Page:** The user should never have to guess what the page is for. Every view must have exactly one dominant task or piece of information.
- **No Dashboard Sludge:** Do not fill screens with arbitrary analytics, "engagement" widgets, gamification, or unnecessary charts. If a data point doesn't explicitly inform a hiring, operational, or verification decision: remove it.
- **Hierarchy of Truth:** The most strictly verified information (primary source + timestamp) must sit at the top of the visual hierarchy.

## 3. Motion & Animation
- **Explain State, Don't Decorate:** Motion is a functional tool. It should only be used to explain system state changes or direct user attention to a critical transition.
- **Allowed Motion:** Expanding a row to reveal details, transitioning a badge from "Pending" to "Verified", or a subtle, accurate skeleton pulse during an active network fetch.
- **Prohibited Motion:** Bouncing buttons, parallax scrolling, "confetti", arbitrary hover expansions that shift layout, or any animation that draws attention without conveying system state. If it feels "fun," it's probably wrong.

## 4. Light/Dark Behavior Rules
- **System Match by Default:** The interface must respect the user's OS preference (`prefers-color-scheme`) automatically and perfectly.
- **High Contrast:** Both light and dark modes must maintain strict WCAG AAA contrast ratios for all critical text, especially in the "Truth Layer" (verification badges, sources, timestamps).
- **Dark Mode Specifics:** Use pure black (`#000000`) backgrounds with crisp white text. Avoid mid-greys that create a "muddy" or low-contrast appearance. Shadows should be eliminated in dark mode in favor of subtle borders to delineated overlapping planes.
- **Light Mode Specifics:** Use pure white backgrounds with sharp black text and subtle, cool-grey borders for structure.
