export const STORAGE_KEY = "flowmaid-state";
export const PANEL_STATE_KEY = "flowmaid-panels";
export const MINIMAP_STORAGE_KEY = "flowmaid-minimap";

export const DEFAULT_NODE_WIDTH = 150;
export const DEFAULT_NODE_HEIGHT = 50;
export const DEFAULT_DIAMOND_SIZE = 100;

export const AUTOSAVE_DEBOUNCE_MS = 1000;

// Predictive input
export const PREDICTIVE_DETECT_RANGE = 40;
export const PREDICTIVE_ARROW_OFFSET_PX = 28;
export const PREDICTIVE_GAP_PX = 60;
export const GHOST_NODE_ID = "__ghost__";
export const SNAP_GRID_SIZE = 5;

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
