export const STORAGE_KEY = "flowmaid-state";
export const PANEL_STATE_KEY = "flowmaid-panels";
export const MINIMAP_STORAGE_KEY = "flowmaid-minimap";
export const BETA_NOTICE_DISMISSED_KEY = "flowmaid-beta-notice-dismissed";
export const GITHUB_ISSUES_URL = "https://github.com/kmiki0/flowmaid/issues/new/choose";

export const DEFAULT_NODE_WIDTH = 160;
export const DEFAULT_NODE_HEIGHT = 60;
export const DEFAULT_DIAMOND_SIZE = 100;

export const AUTOSAVE_DEBOUNCE_MS = 1000;

// Predictive input
export const PREDICTIVE_DETECT_RANGE = 40;
export const PREDICTIVE_ARROW_OFFSET_PX = 28;
export const PREDICTIVE_GAP_PX = 60;
export const GHOST_NODE_ID = "__ghost__";
export const SNAP_GRID_SIZE = 5;
export const GRID_SNAP_SIZE = 20;
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 4;
export const ZOOM_ACTIVATION_KEY_CODE: string[] = ["Control", "Meta"];
export const GRID_SNAP_STORAGE_KEY = "flowmaid-grid-snap";
export const GHOST_ENABLED_STORAGE_KEY = "flowmaid-ghost-enabled";

export const NODE_SHAPE_LABELS: Record<string, string> = {
  rectangle: "Rectangle",
  diamond: "Diamond",
  roundedRect: "Rounded Rect",
  circle: "Circle",
  parallelogram: "Parallelogram",
  cylinder: "Cylinder",
  hexagon: "Hexagon",
  stadium: "Stadium",
  trapezoid: "Trapezoid",
  document: "Document",
  predefinedProcess: "Predefined Process",
  manualInput: "Manual Input",
  internalStorage: "Internal Storage",
  display: "Display",
};
