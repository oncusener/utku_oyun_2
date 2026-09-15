// Gesture handler insists on being the first import in the bundle.
import 'react-native-gesture-handler';

// Resolved per platform: bootstrap.native.ts on iOS and Android,
// bootstrap.web.ts in the browser.
import './src/bootstrap';
