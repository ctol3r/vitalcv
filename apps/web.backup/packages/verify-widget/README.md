# VitalCV Verify Widget

Embeddable verification widget for VitalCV credentials. Drop this into any website to enable credential verification.

## Features

- ✅ Themeable (brand color, border radius, size)
- ✅ Standalone with minimal dependencies
- ✅ CSS isolation (scoped styles)
- ✅ Callback-based API
- ✅ TypeScript support

## Installation

### Script Tag (Vanilla JS)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Verify Credentials</title>
</head>
<body>
  <div id="verify-widget"></div>

  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://vitalcv.com/widget/verify.js"></script>

  <script>
    // Mount the widget
    VitalCV.renderVerifyWidget('#verify-widget', {
      brandColor: '#6366f1',
      borderRadius: '12px',
      size: 'md',
      onVerifySuccess: (credential) => {
        console.log('Verified!', credential);
      },
      onVerifyFail: (errorCode, errorMessage) => {
        console.error('Failed:', errorCode, errorMessage);
      }
    });
  </script>
</body>
</html>
```

### React / Next.js

```bash
npm install @vitalcv/verify-widget
# or
yarn add @vitalcv/verify-widget
```

```tsx
import { VerifyWithVitalCV } from '@vitalcv/verify-widget';

export default function MyPage() {
  return (
    <VerifyWithVitalCV
      brandColor="#6366f1"
      borderRadius="12px"
      size="md"
      onVerifySuccess={(credential) => {
        console.log('Verified!', credential);
      }}
      onVerifyFail={(errorCode, errorMessage) => {
        console.error('Failed:', errorCode, errorMessage);
      }}
    />
  );
}
```

## Props / Options

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `brandColor` | `string` | `"#6366f1"` | Primary brand color (any CSS color) |
| `borderRadius` | `string` | `"0.5rem"` | Border radius (e.g., `"8px"`, `"none"`, `"1rem"`) |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Widget size preset |
| `apiEndpoint` | `string` | `"https://vitalcv.com/api/verifier/presentation"` | Custom verification API endpoint |
| `enableScanner` | `boolean` | `true` | Show QR scanner option |
| `onVerifySuccess` | `(credential: any) => void` | - | Callback when verification succeeds |
| `onVerifyFail` | `(errorCode: string, errorMessage: string) => void` | - | Callback when verification fails |
| `labels` | `object` | - | Custom UI labels (see below) |
| `className` | `string` | `""` | Additional CSS class |

### Custom Labels

```tsx
{
  labels: {
    title: "Verify Your Credential",
    scanButton: "Scan QR Code",
    pasteButton: "Paste Credential",
    verifying: "Checking...",
    success: "Verified!",
    failure: "Verification Failed"
  }
}
```

## Theming Examples

### Material Design Style
```tsx
<VerifyWithVitalCV
  brandColor="#1976d2"
  borderRadius="4px"
  size="md"
/>
```

### Rounded Modern Style
```tsx
<VerifyWithVitalCV
  brandColor="#8b5cf6"
  borderRadius="1rem"
  size="lg"
/>
```

### Minimal Flat Style
```tsx
<VerifyWithVitalCV
  brandColor="#059669"
  borderRadius="0"
  size="sm"
/>
```

## CSS Isolation Note

⚠️ **Important:** This widget uses scoped CSS (prefixed with `.vitalcv-*`). While it won't affect your host page styles, **your host page styles also won't affect the widget**. This is by design for portability.

If you need to customize beyond the provided theming props, you can:

1. Wrap the widget and apply custom CSS:
```css
.my-wrapper .vitalcv-widget {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

2. Or fork the widget and modify the internal styles.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

## Security

- Widget communicates with VitalCV API over HTTPS only
- No credentials are stored locally
- All verification happens server-side
- Supports Content Security Policy (CSP)

## Advanced Usage

### Custom Verification Endpoint

If you're running your own VitalCV verifier instance:

```tsx
<VerifyWithVitalCV
  apiEndpoint="https://your-verifier.example.com/api/verify"
  onVerifySuccess={(credential) => {
    // Send to your backend
    fetch('/api/log-verification', {
      method: 'POST',
      body: JSON.stringify(credential)
    });
  }}
/>
```

### Headless Mode (Bring Your Own UI)

```tsx
import { verifyCredential } from '@vitalcv/verify-widget/headless';

const result = await verifyCredential(credentialData, {
  apiEndpoint: 'https://vitalcv.com/api/verifier/presentation'
});

if (result.verified) {
  console.log('Success!', result);
} else {
  console.error('Failed:', result.error);
}
```

## Support

- 📖 [Full Documentation](https://docs.vitalcv.com/widget)
- 💬 [Discord Community](https://discord.gg/vitalcv)
- 📧 Email: support@vitalcv.com

## License

MIT

