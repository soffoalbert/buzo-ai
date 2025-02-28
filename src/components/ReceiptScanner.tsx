import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';

interface ReceiptScannerProps {
  onCapture: (imageUri: string, extractedData?: any) => void;
  onClose: () => void;
  visible: boolean;
  showGalleryOption?: boolean;
  showFlashOption?: boolean;
  showGuideLines?: boolean;
  processingEnabled?: boolean;
  title?: string;
  instructions?: string;
}

// Mock data for demonstration
const MOCK_RECEIPT_IMAGE = 'https://via.placeholder.com/300x500?text=Receipt+Image';

const ReceiptScanner: React.FC<ReceiptScannerProps> = ({
  onCapture,
  onClose,
  visible,
  showGalleryOption = true,
  showFlashOption = true,
  showGuideLines = true,
  processingEnabled = true,
  title = 'Scan Receipt',
  instructions = 'Position the receipt within the frame and ensure it\'s well-lit',
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  // Simulate taking a picture
  const takePicture = async () => {
    if (!isCapturing) {
      setIsCapturing(true);
      try {
        // Simulate camera capture delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Use mock image for demonstration
        setCapturedImage(MOCK_RECEIPT_IMAGE);
        
        if (processingEnabled) {
          setIsProcessing(true);
          // Simulate processing delay
          setTimeout(() => {
            setIsProcessing(false);
            // Mock extracted data
            const mockExtractedData = {
              merchant: 'Sample Store',
              date: new Date().toISOString(),
              total: 123.45,
              items: [
                { name: 'Item 1', price: 45.67 },
                { name: 'Item 2', price: 77.78 }
              ]
            };
            onCapture(MOCK_RECEIPT_IMAGE, mockExtractedData);
          }, 2000);
        } else {
          onCapture(MOCK_RECEIPT_IMAGE);
        }
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to capture image');
      } finally {
        setIsCapturing(false);
      }
    }
  };
  
  // Retake picture
  const retakePicture = () => {
    setCapturedImage(null);
    setIsProcessing(false);
  };
  
  // Pick image from gallery
  const pickImage = async () => {
    Alert.alert(
      'Feature Not Implemented',
      'Gallery selection will be implemented in a future update',
      [{ text: 'OK' }]
    );
  };
  
  // Toggle flash mode (placeholder)
  const toggleFlashMode = () => {
    Alert.alert(
      'Flash Toggle',
      'Flash toggled (placeholder functionality)',
      [{ text: 'OK' }]
    );
  };
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.placeholder} />
        </View>
        
        {/* Camera Preview or Captured Image */}
        <View style={styles.cameraContainer}>
          {capturedImage ? (
            // Show captured image
            <Image source={{ uri: capturedImage }} style={styles.camera} />
          ) : (
            // Show camera preview placeholder
            <View style={styles.cameraPlaceholder}>
              {/* Guide lines overlay */}
              {showGuideLines && (
                <View style={styles.guideContainer}>
                  <View style={styles.guideFrame} />
                </View>
              )}
              <Text style={styles.placeholderText}>
                Camera preview would appear here
              </Text>
              <Text style={styles.placeholderSubtext}>
                (Actual camera implementation requires expo-camera setup)
              </Text>
            </View>
          )}
          
          {/* Instructions */}
          {!capturedImage && (
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructions}>{instructions}</Text>
            </View>
          )}
          
          {/* Processing overlay */}
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.processingText}>Processing receipt...</Text>
            </View>
          )}
        </View>
        
        {/* Controls */}
        <View style={styles.controls}>
          {capturedImage ? (
            // Controls for captured image
            <View style={styles.capturedControls}>
              <Button 
                title="Retake" 
                onPress={retakePicture} 
                variant="outline"
                style={styles.controlButton}
              />
              <Button 
                title="Use Photo" 
                onPress={() => onCapture(capturedImage)} 
                variant="primary"
                style={styles.controlButton}
                isLoading={isProcessing}
                disabled={isProcessing}
              />
            </View>
          ) : (
            // Controls for camera
            <View style={styles.cameraControls}>
              {/* Gallery button */}
              {showGalleryOption && (
                <TouchableOpacity onPress={pickImage} style={styles.iconButton}>
                  <Ionicons name="images" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              
              {/* Capture button */}
              <TouchableOpacity 
                onPress={takePicture} 
                style={styles.captureButton}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <ActivityIndicator size="small" color="#4F46E5" />
                ) : (
                  <View style={styles.captureButtonInner} />
                )}
              </TouchableOpacity>
              
              {/* Flash button */}
              {showFlashOption && (
                <TouchableOpacity onPress={toggleFlashMode} style={styles.iconButton}>
                  <Ionicons 
                    name="flash" 
                    size={28} 
                    color="#FFFFFF" 
                  />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');
const GUIDE_PADDING = 40;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 44,
    height: 44,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  placeholderSubtext: {
    color: '#CCCCCC',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  guideContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideFrame: {
    width: width - GUIDE_PADDING * 2,
    height: (width - GUIDE_PADDING * 2) * 1.4, // Approximate receipt ratio
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  instructions: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  controls: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#000000',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  capturedControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    padding: 12,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
  },
  controlButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});

export default ReceiptScanner; 