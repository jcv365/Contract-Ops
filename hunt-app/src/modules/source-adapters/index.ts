import { adapterRegistry } from './base';
import { JobicyAdapter } from './jobicy';
import { JobsColliderAdapter } from './jobscollider';

// Registered once at process start. Only sources with adapterStatus=ACTIVE
// in the database are actually invoked by the hunt-engine — registering an
// adapter here makes it *available*, not enabled (docs-pack/docs/22).
export function registerAdapters(): void {
  adapterRegistry.register(new JobicyAdapter());
  adapterRegistry.register(new JobsColliderAdapter());
}

export { adapterRegistry };
