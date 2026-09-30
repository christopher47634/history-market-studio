// v3 只按需引入用到的 ECharts 模块。
import * as echarts from "echarts/core";
import { LineChart, ScatterChart, CustomChart, EffectScatterChart } from "echarts/charts";
import { GridComponent, DataZoomComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent, AxisPointerComponent } from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, ScatterChart, CustomChart, EffectScatterChart, GridComponent, DataZoomComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent, AxisPointerComponent, LabelLayout, UniversalTransition, CanvasRenderer]);

export default echarts;
