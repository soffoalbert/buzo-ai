import React, { useState, useEffect } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import Button from './Button';
import { processReceiptImage } from '../services/receiptService';
import { colors } from '../utils/theme';

interface ReceiptScannerProps {
  onCapture: (imageUri: string, extractedData?: any) => void;
  onClose: () => void;
  visible: boolean;
  showGalleryOption?: boolean;
  processingEnabled?: boolean;
  title?: string;
  instructions?: string;
}

const ReceiptScanner: React.FC<ReceiptScannerProps> = ({
  onCapture,
  onClose,
  visible,
  showGalleryOption = true,
  processingEnabled = true,
  title = 'Scan Receipt',
  instructions = 'Select an image from your gallery to scan the receipt',
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  // Pick image from gallery
  const pickImage = async () => {
    try {
      // Request permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Gallery Permission Required',
          'We need gallery access to select receipt images. Please grant permission in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        setCapturedImage(selectedImage.uri);
        
        if (processingEnabled) {
          setIsProcessing(true);
          try {
            // Process the image with OCR
            const extractedData = await processReceiptImage(selectedImage.uri, selectedImage.base64);
            setIsProcessing(false);
            onCapture(selectedImage.uri, extractedData);
          } catch (error) {
            console.error('Error processing receipt:', error);
            setIsProcessing(false);
            Alert.alert(
              'Processing Error',
              'Could not process the receipt. Please try again or enter details manually.',
              [{ text: 'OK' }]
            );
            // Still provide the image even if processing failed
            onCapture(selectedImage.uri);
          }
        } else {
          onCapture(selectedImage.uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image from gallery');
    }
  };
  
  // Retake picture
  const retakePicture = () => {
    setCapturedImage(null);
    setIsProcessing(false);
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
        
        {/* Image Preview or Placeholder */}
        <View style={styles.cameraContainer}>
          {capturedImage ? (
            // Show captured image
            <Image source={{ uri: capturedImage }} style={styles.camera} resizeMode="contain" />
          ) : (
            // Show placeholder
            <View style={styles.cameraPlaceholder}>
              <Ionicons name="images-outline" size={64} color="#AAAAAA" />
              <Text style={styles.placeholderText}>No image selected</Text>
              <Text style={styles.placeholderSubtext}>{instructions}</Text>
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
                title="Select Another" 
                onPress={retakePicture} 
                variant="outline"
                style={styles.controlButton}
              />
              <Button 
                title="Use This Image" 
                onPress={() => {
                  if (!isProcessing) {
                    onCapture(capturedImage);
                  }
                }} 
                variant="primary"
                style={styles.controlButton}
                isLoading={isProcessing}
                disabled={isProcessing}
              />
            </View>
          ) : (
            // Controls for selecting image
            <View style={styles.capturedControls}>
              <Button 
                title="Select from Gallery" 
                onPress={pickImage} 
                variant="primary"
                style={{ flex: 1 }}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222222',
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  placeholderSubtext: {
    color: '#AAAAAA',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
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
    backgroundColor: '#000000',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  capturedControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlButton: {
    flex: 0.48,
    marginHorizontal: 4,
  },
});

export default ReceiptScanner; 