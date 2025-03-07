import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Canvas, Circle, Group, Path, Skia, useValue, runTiming, BlurMask } from '@shopify/react-native-skia';
import { Easing } from 'react-native-reanimated';
import { colors } from '../utils/theme';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

/**
 * A modern high-performance loading spinner component using React Native Skia
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 100,
  color = colors.primary || '#3498db',
  style,
}) => {
  // Animation value for rotation
  const rotation = useValue(0);
  
  // Animation value for the dash offset
  const dashOffset = useValue(0);
  
  // Start animations when component mounts
  useEffect(() => {
    // Continuously rotate the spinner
    const rotationLoop = () => {
      runTiming(
        rotation,
        { from: 0, to: Math.PI * 2 },
        { duration: 1500, easing: Easing.linear }
      );
      
      setTimeout(() => {
        rotation.current = 0;
        rotationLoop();
      }, 1500);
    };
    
    // Animate the dash offset for the loading effect
    const dashLoop = () => {
      runTiming(
        dashOffset,
        { from: 0, to: Math.PI * 2 },
        { duration: 1800, easing: Easing.inOut(Easing.cubic) }
      );
      
      setTimeout(() => {
        dashOffset.current = 0;
        dashLoop();
      }, 1800);
    };
    
    rotationLoop();
    dashLoop();
    
    // Clean up animations on unmount
    return () => {
      rotation.current = 0;
      dashOffset.current = 0;
    };
  }, []);
  
  // Calculate dimensions
  const center = size / 2;
  const strokeWidth = size / 10;
  const radius = (size - strokeWidth) / 2;
  
  // Create a circular path
  const path = Skia.Path.Make();
  path.addCircle(center, center, radius);
  
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Canvas style={styles.canvas}>
        <Group transform={[{ rotate: rotation }]} origin={{ x: center, y: center }}>
          <Path
            path={path}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
            color={color}
            start={0}
            end={0.75}
            strokeStart={dashOffset}
          >
            <BlurMask blur={strokeWidth / 8} style="solid" />
          </Path>
        </Group>
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvas: {
    flex: 1,
  },
});

export default LoadingSpinner; 