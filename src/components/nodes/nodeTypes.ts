import { RectangleNode } from "./RectangleNode";
import { DiamondNode } from "./DiamondNode";
import { RoundedRectNode } from "./RoundedRectNode";
import { CircleNode } from "./CircleNode";
import { ParallelogramNode } from "./ParallelogramNode";
import { CylinderNode } from "./CylinderNode";
import { HexagonNode } from "./HexagonNode";
import { StadiumNode } from "./StadiumNode";
import { TrapezoidNode } from "./TrapezoidNode";
import { DocumentNode } from "./DocumentNode";
import { PredefinedProcessNode } from "./PredefinedProcessNode";
import { ManualInputNode } from "./ManualInputNode";
import { InternalStorageNode } from "./InternalStorageNode";
import { DisplayNode } from "./DisplayNode";
import { ComponentInstanceNode } from "./ComponentInstanceNode";
export const nodeTypes = {
  rectangle: RectangleNode,
  diamond: DiamondNode,
  roundedRect: RoundedRectNode,
  circle: CircleNode,
  parallelogram: ParallelogramNode,
  cylinder: CylinderNode,
  hexagon: HexagonNode,
  stadium: StadiumNode,
  trapezoid: TrapezoidNode,
  document: DocumentNode,
  predefinedProcess: PredefinedProcessNode,
  manualInput: ManualInputNode,
  internalStorage: InternalStorageNode,
  display: DisplayNode,
  text: RectangleNode,
  componentInstance: ComponentInstanceNode,
};
