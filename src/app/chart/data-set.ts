import * as d3 from 'd3';

import { sampleData as dataFile } from './sample-data';
import { IDataPoint } from './data-point';

export class ChartDataSet {
  // TODO: Replace publics with proper accessors
  public data: IDataPoint[];
  public xMin: Date;
  public xMax: Date;
  public yMin: number;
  public yMax: number;

  public loadData() {
    this.data = dataFile[0].data as IDataPoint[];
    [this.xMin, this.xMax] = d3.extent<IDataPoint, Date>(this.data, d => d3.isoParse(d.t));
    [this.yMin, this.yMax] = d3.extent<IDataPoint, number>(this.data, d => d.v).reverse();
  }
}
