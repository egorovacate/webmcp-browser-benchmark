const capabilities = ['navigate', 'dom', 'click', 'type', 'press', 'scroll'];

export function createVisualMode() {
  return {
    name: 'visual',
    allowedCapabilities: [...capabilities],
    buildTools() {
      return capabilities.map((name) => ({ name, mode: 'visual' }));
    },
    validateObservation(observation = {}) {
      if (observation.screenshot || observation.accessibilitySnapshot || observation.webmcpTools) {
        throw new Error('forbidden observation for visual mode');
      }
      return true;
    },
  };
}
