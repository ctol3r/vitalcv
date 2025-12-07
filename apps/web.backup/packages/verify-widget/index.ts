/**
 * VitalCV Verify Widget - Entry Point
 * Export both React component and script loader
 */

export { VerifyWithVitalCV } from './VerifyWidget';

// Script loader initialization
if (typeof window !== 'undefined') {
  const initializeWidget = () => {
    const widgetElements = document.querySelectorAll('[data-vitalcv-widget]');

    widgetElements.forEach((element) => {
      const apiKey = element.getAttribute('data-api-key') || '';
      const mode = (element.getAttribute('data-mode') || 'both') as 'qr' | 'button' | 'both';
      const theme = (element.getAttribute('data-theme') || 'auto') as 'light' | 'dark' | 'auto';
      const buttonText = element.getAttribute('data-button-text') || 'Verify with VitalCV';

      // Import React and ReactDOM dynamically if not already loaded
      import('react').then((React) => {
        import('react-dom/client').then((ReactDOM) => {
          const { VerifyWithVitalCV } = require('./VerifyWidget');

          const root = ReactDOM.createRoot(element);
          root.render(
            React.createElement(VerifyWithVitalCV, {
              apiKey,
              mode,
              theme,
              buttonText,
            }),
          );
        });
      });
    });
  };

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidget);
  } else {
    initializeWidget();
  }
}
