import { fetchCults3dSnapshot } from './clients/cults3dClient.js';
import { fetchMakerworldSnapshot } from './clients/makerworldClient.js';
import { fetchThangsSnapshot } from './clients/thangsClient.js';
import { fetchPrintablesSnapshot } from './clients/printablesClient.js';

const CONNECTOR_REGISTRY = {
  cults3d: {
    id: 'cults3d',
    client: fetchCults3dSnapshot,
    capabilities: {
      supportsMultipleAccounts: true,
      snapshotFields: ['series', 'models', 'fetchedAt', 'quality'],
      source: 'cults3d_api'
    }
  },
  makerworld: {
    id: 'makerworld',
    client: fetchMakerworldSnapshot,
    capabilities: {
      supportsMultipleAccounts: true,
      snapshotFields: ['series', 'models', 'fetchedAt', 'quality'],
      source: 'makerworld_api'
    }
  },
  thangs: {
    id: 'thangs',
    client: fetchThangsSnapshot,
    capabilities: {
      supportsMultipleAccounts: true,
      snapshotFields: ['series', 'models', 'fetchedAt', 'quality'],
      source: 'thangs_hybrid'
    }
  },
  printables: {
    id: 'printables',
    client: fetchPrintablesSnapshot,
    capabilities: {
      supportsMultipleAccounts: true,
      snapshotFields: ['series', 'models', 'fetchedAt', 'quality'],
      source: 'printables_api'
    }
  }
};

export function getConnectorRegistration(platformId) {
  return CONNECTOR_REGISTRY[platformId] ?? null;
}

export function listRegisteredConnectors() {
  return Object.values(CONNECTOR_REGISTRY);
}
