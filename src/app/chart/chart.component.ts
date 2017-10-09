import { Component, Input, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import * as d3 from 'd3';

import { ChartDataSet } from './data-set';
import { IDataPoint } from './data-point';

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartComponent implements AfterViewInit {
  @Input() chartId: string;
  @ViewChild('chart') chartElement: ElementRef;

  private dataSet: ChartDataSet = new ChartDataSet();

  private host: d3.Selection<any, any, any, any>;
  private hostWidth: number;
  private hostHeight: number;

  private margin: { top: number, right: number, bottom: number, left: number };
  private width: number;
  private height: number;

  private svg: d3.Selection<any, any, any, any>;
  private chartBody: d3.Selection<any, any, any, any>;
  private axesContainer: d3.Selection<any, any, any, any>;
  private clipPath: d3.Selection<any, any, any, any>;

  private xScaleUnzoomed: d3.ScaleTime<number, number>;
  private xScale: d3.ScaleTime<number, number>;
  private xAxis: d3.Axis<any>;
  private xAxisElement: d3.Selection<any, any, any, any>;

  private yScaleUnzoomed: d3.ScaleLinear<number, number>;
  private yScale: d3.ScaleLinear<number, number>;
  private yAxis: d3.Axis<any>;
  private yAxisElement: d3.Selection<any, any, any, any>;

  private brushElement: d3.Selection<any, any, any, any>;
  private brush: d3.BrushBehavior<any>;

  private zoomX: d3.ZoomBehavior<any, any>;
  private zoomY: d3.ZoomBehavior<any, any>;
  private zoomXElement: d3.Selection<any, any, any, any>;
  private zoomYElement: d3.Selection<any, any, any, any>;

  private scatterPointSize = 2.5;
  private scatterPoints: d3.Selection<any, any, any, any>;
  private area: d3.Area<IDataPoint>;
  private areaElement: d3.Selection<any, any, any, any>;
  private line: d3.Line<IDataPoint>;
  private lineElement: d3.Selection<any, any, any, any>;

  ngAfterViewInit() {
    this.setupChart();
  }

  setupChart() {
    this.dataSet.loadData();

    this.host = d3.select(this.chartElement.nativeElement);
    this.hostWidth = parseInt(this.host.style('width'), 10);
    this.hostHeight = 400;

    this.margin = { top: 5, right: 5, bottom: 30, left: 35 };
    this.width = this.hostWidth - this.margin.left - this.margin.right,
    this.height = this.hostHeight - this.margin.top - this.margin.bottom;

    this.svg = this.chartBody = this.host.append('svg')
        .attr('width', this.hostWidth)
        .attr('height', this.hostHeight);

    // Create a clip path
    const clipPathId = `clip${this.chartId}`;
    const clipPathUrl = `${window.location.protocol}//${window.location.host}/#clip${this.chartId}`;

    this.clipPath = this.svg.append('clipPath').attr('id', clipPathId)
      .append('rect')
        .attr('width', this.width)
        .attr('height', this.height);

    // Create separate containers to hold the chart body and axes
    this.chartBody = this.svg.append('g')
        .attr('clip-path', `url(${clipPathUrl})`)
        .attr('transform', `translate(${this.margin.left},${this.margin.top})`)
        .attr('width', this.width)
        .attr('height', this.height);

    this.axesContainer = this.svg.append('g')
        .attr('transform', `translate(${this.margin.left},${this.margin.top})`)
        .attr('width', this.width)
        .attr('height', this.height);

    // X-Axis
    this.xScale = d3.scaleTime()
        .domain([this.dataSet.xMin, this.dataSet.xMax])
        .range([0, this.width]);

    this.xAxis = d3.axisBottom(this.xScale);

    this.xAxisElement = this.axesContainer.append('g')
        .classed('x-axis', true)
        .attr('transform', `translate(0,${this.height})`)
        .call(this.xAxis);

    // Y-Axis
    this.yScale = d3.scaleLinear()
        .domain([this.dataSet.yMin, this.dataSet.yMax])
        .range([0, this.height]);

    this.yAxis = d3.axisLeft(this.yScale);

    this.yAxisElement = this.axesContainer.append('g')
        .classed('y-axis', true)
        .call(this.yAxis);

    // Setup area / line generators
    this.area = d3.area<IDataPoint>()
      .x(d => this.xScale(d3.isoParse(d.t)))
      .y0(d => this.yScale(d.v - 20))
      .y1(d => this.yScale(d.v + 20))
      .defined(d => !d.isGap);

    this.areaElement = this.chartBody.append('path')
      .attr('fill', '#6a3d9a')
      .attr('fill-opacity', '0.1');

    this.line = d3.line<IDataPoint>()
        .x(d => this.xScale(d3.isoParse(d.t)))
        .y(d => this.yScale(d.v))
        .defined(d => !d.isGap);

    this.lineElement = this.chartBody.append('path')
        .attr('fill', 'none')
        .attr('stroke', '#6a3d9a')
        .attr('stroke-opacity', '0.0');

    // Zoom
    this.setupZooming();

    // Brushing
    this.setupBrushing();

    this.chartBody.on('dblclick', () => {
      this.zoomXTo(this.dataSet.xMin, this.dataSet.xMax, true);
    });

    // Draw initial data
    this.update(0);
  }

  setupBrushing(): void {
    this.brush = d3.brushX()
      .extent([[0, 0], [this.width, this.height]])
      .on('end', () => {
        if (d3.event.selection) {
          this.brushElement.call(this.brush.move, null);

          const [x0, x1] = d3.event.selection;

          const d0 = this.xScale.invert(x0);
          const d1 = this.xScale.invert(x1);

          this.zoomXTo(d0, d1, true);
        }
      });

    this.brushElement = this.chartBody
      .append('g')
        .classed('brush-area', true)
        .attr('width', this.width)
        .attr('height', this.height)
        .style('pointer-events', 'all')
        .call(this.brush);
  }

  setupZooming(): void {
    this.zoomX = d3.zoom().on('zoom', () => { this.onZoomX(); });
    this.zoomY = d3.zoom().on('zoom', () => { this.onZoomY(); });

    this.xScaleUnzoomed = this.xScale.copy();
    this.yScaleUnzoomed = this.yScale.copy();

    this.zoomXElement = this.xAxisElement
      .append('rect')
        .attr('fill', 'red')
        .attr('fill-opacity', 0.2)
        .style('pointer-events', 'all')
        .attr('width', this.width)
        .attr('height', this.hostHeight)
        // TODO: Uncommenting this line means that zooming with the wheel works on the
        // whole chart area, but steals other mouse inputs too, so brushing doesn't work:
        //.attr('transform', `translate(0,-${this.height})`)
        .call(this.zoomX);

    this.zoomYElement = this.yAxisElement
      .append('rect')
        .attr('fill', 'lime')
        .attr('fill-opacity', 0.2)
        .style('pointer-events', 'all')
        .attr('width', this.margin.left)
        .attr('height', this.height)
        .attr('transform', `translate(-${this.margin.left}, 0)`)
        .call(this.zoomY);
  }

  onZoomX(): void {
    const transform = d3.event.transform;

    const newXScale: d3.ScaleTime<number, number> = transform.rescaleX(this.xScaleUnzoomed);

    this.xScale.domain(newXScale.domain());
    this.xAxis.scale(this.xScale);
    this.xAxisElement.call(this.xAxis);

    this.update(0);
  }

  onZoomY(): void {
    const transform = d3.event.transform;

    const newYScale: d3.ScaleLinear<number, number> = transform.rescaleY(this.yScaleUnzoomed);

    this.yScale.domain(newYScale.domain());
    this.yAxis.scale(this.yScale);
    this.yAxisElement.call(this.yAxis);

    this.update(0);
  }

  zoomXTo(x0: Date, x1: Date, animate: boolean): void {
    const transitionSpeed = animate ? 750 : 0;

    this.zoomXElement.transition().duration(transitionSpeed).call(this.zoomX.transform,
      d3.zoomIdentity
        .scale(this.width / (this.xScaleUnzoomed(x1) - this.xScaleUnzoomed(x0)))
        .translate(-this.xScaleUnzoomed(x0), 0)
    );
  }

  update(transitionSpeed: number): void {
    // Scatter
    this.scatterPoints = this.chartBody.selectAll('circle')
        .data(this.dataSet.data, (d: IDataPoint) => d.t.toString());

    this.scatterPoints.enter().append('circle')
        .attr('r', 2.5)
        .attr('fill', '#6a3d9a')
        .attr('fill-opacity', d => d.isGap ? '0' : '0.5')
      .merge(this.scatterPoints)
        .transition().duration(transitionSpeed)
        .attr('cx', d => this.xScale(d3.isoParse(d.t)))
        .attr('cy', d => this.yScale(d.v));

    this.scatterPoints.exit().remove();

    // Line
    this.lineElement
        .transition().duration(transitionSpeed)
        .attr('d', this.line(this.dataSet.data))
        .attr('stroke-opacity', '0.2');
  }
}
