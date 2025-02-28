import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  ViewStyle, 
  TextStyle,
  ScrollView
} from 'react-native';
import {
  LineChart,
  BarChart,
  PieChart,
  ProgressChart,
  ContributionGraph,
} from 'react-native-chart-kit';

export type ChartType = 'line' | 'bar' | 'pie' | 'progress' | 'contribution';

export interface ChartData {
  labels: string[];
  datasets: {
    data: number[];
    color?: (opacity?: number) => string;
    colors?: string[];
    strokeWidth?: number;
  }[];
  legend?: string[];
}

export interface PieChartData {
  name: string;
  value: number;
  color: string;
  legendFontColor?: string;
  legendFontSize?: number;
}

export interface ProgressChartData {
  data: number[]; // Values between 0 and 1
  colors?: string[];
}

export interface ContributionData {
  date: string;
  count: number;
}

interface ChartProps {
  type: ChartType;
  data: ChartData | PieChartData[] | ProgressChartData | ContributionData[];
  width?: number;
  height?: number;
  title?: string;
  subtitle?: string;
  yAxisSuffix?: string;
  yAxisPrefix?: string;
  formatYLabel?: (value: string) => string;
  formatXLabel?: (value: string) => string;
  showLegend?: boolean;
  showGrid?: boolean;
  showValues?: boolean;
  containerStyle?: ViewStyle;
  chartStyle?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  scrollable?: boolean;
  backgroundColor?: string;
  backgroundGradientFrom?: string;
  backgroundGradientTo?: string;
  decimalPlaces?: number;
  hideLegend?: boolean;
}

const Chart: React.FC<ChartProps> = ({
  type,
  data,
  width = Dimensions.get('window').width - 32,
  height = 220,
  title,
  subtitle,
  yAxisSuffix = '',
  yAxisPrefix = '',
  formatYLabel,
  formatXLabel,
  showLegend = true,
  showGrid = true,
  showValues = true,
  containerStyle,
  chartStyle,
  titleStyle,
  subtitleStyle,
  scrollable = false,
  backgroundColor = '#FFFFFF',
  backgroundGradientFrom = '#FFFFFF',
  backgroundGradientTo = '#FFFFFF',
  decimalPlaces = 2,
  hideLegend = false,
}) => {
  // Common chart configuration
  const chartConfig = {
    backgroundColor,
    backgroundGradientFrom,
    backgroundGradientTo,
    decimalPlaces,
    color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`, // Indigo color
    labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#4F46E5',
    },
    propsForLabels: {
      fontSize: 12,
    },
    formatYLabel: formatYLabel || ((value) => value),
    formatXLabel: formatXLabel || ((value) => value),
  };
  
  // Render the appropriate chart based on type
  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart
            data={data as ChartData}
            width={width}
            height={height}
            chartConfig={{
              ...chartConfig,
              strokeWidth: 3,
              propsForDots: {
                r: '5',
                strokeWidth: '2',
                stroke: '#4F46E5',
              },
              fillShadowGradientFrom: '#4F46E5',
              fillShadowGradientTo: 'rgba(79, 70, 229, 0.1)',
              fillShadowGradientOpacity: 0.5,
              useShadowColorFromDataset: false,
            }}
            bezier
            style={[styles.chart, chartStyle]}
            withInnerLines={showGrid}
            withOuterLines={showGrid}
            withDots={showValues}
            withShadow={false}
            yAxisSuffix={yAxisSuffix}
            yAxisInterval={1}
            fromZero
            hidePointsAtIndex={showValues ? [] : Array.from({ length: (data as ChartData).labels.length }, (_, i) => i)}
            segments={5}
            withHorizontalLabels={true}
            withVerticalLabels={true}
            withHorizontalLines={showGrid}
            withVerticalLines={false}
            yAxisLabel={yAxisPrefix}
            verticalLabelRotation={30}
            xLabelsOffset={-10}
          />
        );
      case 'bar':
        return (
          <BarChart
            data={data as ChartData}
            width={width}
            height={height}
            chartConfig={{
              ...chartConfig,
              barPercentage: 0.7,
              fillShadowGradientFrom: '#4F46E5',
              fillShadowGradientTo: 'rgba(79, 70, 229, 0.1)',
              fillShadowGradientOpacity: 1,
              useShadowColorFromDataset: false,
            }}
            style={[styles.chart, chartStyle]}
            withInnerLines={showGrid}
            withHorizontalLabels={true}
            showBarTops={showValues}
            fromZero
            showValuesOnTopOfBars={showValues}
            withHorizontalLines={showGrid}
            segments={5}
            yAxisSuffix={yAxisSuffix}
            yAxisLabel={yAxisPrefix}
            verticalLabelRotation={30}
            xLabelsOffset={-10}
          />
        );
      case 'pie':
        return (
          <PieChart
            data={data as PieChartData[]}
            width={width}
            height={height}
            chartConfig={chartConfig}
            accessor="value"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
            hasLegend={showLegend && !hideLegend}
            style={[styles.chart, chartStyle]}
          />
        );
      case 'progress':
        return (
          <ProgressChart
            data={data as ProgressChartData}
            width={width}
            height={height}
            chartConfig={chartConfig}
            style={[styles.chart, chartStyle]}
            strokeWidth={16}
            radius={32}
            hideLegend={hideLegend || !showLegend}
          />
        );
      case 'contribution':
        return (
          <ContributionGraph
            values={data as ContributionData[]}
            width={width}
            height={height}
            chartConfig={chartConfig}
            style={[styles.chart, chartStyle]}
            numDays={105}
            endDate={new Date()}
            squareSize={16}
            gutterSize={2}
          />
        );
      default:
        return <Text>Unsupported chart type</Text>;
    }
  };
  
  const ChartContainer = scrollable ? ScrollView : View;
  
  return (
    <View style={[styles.container, containerStyle]}>
      {/* Chart Title and Subtitle */}
      {(title || subtitle) && (
        <View style={styles.titleContainer}>
          {title && <Text style={[styles.title, titleStyle]}>{title}</Text>}
          {subtitle && <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>}
        </View>
      )}
      
      {/* Chart */}
      <ChartContainer 
        horizontal={scrollable} 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={scrollable ? { paddingRight: 20 } : undefined}
      >
        {renderChart()}
      </ChartContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  titleContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  chart: {
    borderRadius: 12,
    paddingRight: 0,
  },
});

export default Chart; 