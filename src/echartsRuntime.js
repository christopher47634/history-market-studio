import * as echarts from "echarts/core";
import { CandlestickChart, LineChart, ScatterChart } from "echarts/charts";
import {
  AxisPointerComponent,
  DataZoomInsideComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  ScatterChart,
  CandlestickChart,
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  DataZoomInsideComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

export const { init } = echarts;
