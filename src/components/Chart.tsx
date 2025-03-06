import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  ViewStyle, 
  TextStyle,
  ScrollView,
  Platform
} from 'react-native';
import {
  LineChart,
  BarChart,
  PieChart,
  ProgressChart,
  ContributionGraph,
} from 'react-native-chart-kit';
import { formatCurrency, formatCurrencyAbbreviated } from '../utils/helpers';

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
  // Default currency formatter that uses abbreviated values for large numbers
  const defaultCurrencyFormatter = (value: string) => {
    const numValue = Number(value);
    if (isNaN(numValue)) return value;
    return formatCurrencyAbbreviated(numValue);
  };

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
    // Use provided formatter or default to currency formatter if yAxisSuffix is 'R' or currency prefix is used
    formatYLabel: formatYLabel || ((yAxisSuffix === 'R' || yAxisPrefix === 'R') ? defaultCurrencyFormatter : (value) => value),
    formatXLabel: formatXLabel || ((value) => value),
  };
  
  // Render the appropriate chart based on type
  const renderChart = () => {
    // For Android, customize chart styles to avoid double borders for pie and line charts
    const chartStylesForAndroid = Platform.OS === 'android' && (type === 'pie' || type === 'line')
      ? { ...styles.chart, borderWidth: 0, elevation: 0 }
      : styles.chart;
      
    // Add debugging logs
    console.log(`Chart.tsx - Rendering ${type} chart with data:`, data);
    
    // Guard against undefined or null data
    if (!data) {
      console.error('Chart data is undefined or null');
      return (
        <View style={[styles.emptyChartContainer, { width, height }]}>
          <Text style={styles.emptyChartText}>No data available</Text>
        </View>
      );
    }
    
    // Check for empty pie chart data
    if (type === 'pie' && Array.isArray(data) && data.length === 0) {
      return (
        <View style={[styles.emptyChartContainer, { width, height }]}>
          <Text style={styles.emptyChartText}>No data available</Text>
        </View>
      );
    }
    
    // Check for empty line/bar chart data
    if ((type === 'line' || type === 'bar') && 
        data && 
        (data as ChartData).datasets && 
        (data as ChartData).datasets[0] && 
        ((data as ChartData).datasets[0].data.length === 0 ||
         (data as ChartData).datasets[0].data.every(value => value === 0))) {
      return (
        <View style={[styles.emptyChartContainer, { width, height }]}>
          <Text style={styles.emptyChartText}>No data available</Text>
        </View>
      );
    }
    
    try {
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
              style={chartStylesForAndroid}
              withInnerLines={showGrid}
              withOuterLines={showGrid}
              withDots={showValues}
              withShadow={false}
              yAxisSuffix={yAxisSuffix}
              yAxisInterval={1}
              fromZero
              hidePointsAtIndex={showValues ? [] : Array.from({ length: (data as ChartData).labels?.length || 0 }, (_, i) => i)}
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
          // Ensure we have valid pie chart data
          if (!Array.isArray(data) || data.length === 0) {
            return (
              <View style={[styles.emptyChartContainer, { width, height }]}>
                <Text style={styles.emptyChartText}>No category data available</Text>
              </View>
            );
          }
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
              style={chartStylesForAndroid}
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
          return (
            <View style={[styles.emptyChartContainer, { width, height }]}>
              <Text style={styles.emptyChartText}>Unsupported chart type</Text>
            </View>
          );
      }
    } catch (error) {
      console.error('Error rendering chart:', error);
      return (
        <View style={[styles.emptyChartContainer, { width, height }]}>
          <Text style={styles.emptyChartText}>Error rendering chart</Text>
          <Text style={styles.errorText}>{error.message}</Text>
        </View>
      );
    }
  };
  
  const ChartContainer = scrollable ? ScrollView : View;
  
  return (
    <View style={[
      styles.container, 
      Platform.OS === 'android' && (type === 'pie' || type === 'line') 
        ? { 
            borderWidth: 0, 
            elevation: 0,
            shadowColor: 'transparent',
            shadowOpacity: 0,
            shadowRadius: 0,
            shadowOffset: { width: 0, height: 0 },
            borderColor: 'transparent',
            backgroundColor: 'transparent'
          } 
        : {},
      containerStyle
    ]}>
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
    ...(Platform.OS === 'android' ? {
      // Default Android styles for all charts
      borderWidth: 0
    } : {})
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
  emptyChartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  emptyChartText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 5,
  },
});

export default Chart; 