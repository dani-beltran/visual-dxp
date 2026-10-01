import { dataTools } from './data';
import type { NodeKind, StepConfig, StepData } from './types';

interface NodeDataPorts {
  acceptsData: boolean;
  outputsData: boolean;
  incomingDataPath?: string;
}

// Define data-port behavior once per node kind. Config changes are evaluated on render.
// These describe data inputs/outputs shown on the canvas, including condition pass-through.
const dataPorts: Partial<Record<NodeKind, (config: StepConfig) => NodeDataPorts>> = {
  trigger: (config) => ({
    acceptsData: false,
    outputsData: config.event === 'commerce-product-added-to-cart',
  }),
  http: () => ({ acceptsData: false, outputsData: true }),
  fork: (config) => ({
    acceptsData: config.conditionType === 'data',
    outputsData: true,
    incomingDataPath: config.conditionDataPath,
  }),
  dom: (config) => ({
    acceptsData: dataTools.usesIncomingValue(config),
    outputsData: false,
    incomingDataPath: config.valueDataPath,
  }),
};

/** Shared by socket colors, incoming-data badges, and connection styling. */
export function getNodeDataPorts(node?: Pick<StepData, 'kind' | 'config'>): NodeDataPorts {
  return (
    (node && dataPorts[node.kind]?.(node.config)) ?? {
      acceptsData: false,
      outputsData: false,
    }
  );
}
