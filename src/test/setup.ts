import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount React trees between tests (redundant with RTL auto-cleanup under
// globals:true, but explicit and harmless).
afterEach(() => cleanup());
