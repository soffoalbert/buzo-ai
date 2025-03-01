import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '../navigation';
import { colors, spacing, textStyles, borderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import BankStatementUploader from '../components/BankStatementUploader';

type BankStatementsScreenProps = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'BankStatements'>;
  route: RouteProp<MainStackParamList, 'BankStatements'>;
};

const BankStatementsScreen: React.FC<BankStatementsScreenProps> = ({ navigation }) => {
  const scrollY = new Animated.Value(0);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  const handleBankStatementUpload = async (fileUri: string, fileName: string) => {
    // Coming soon
  };

  const handleBankStatementUploadError = (error: string) => {
    // Coming soon
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Bank Statement Analysis</Text>
          <Text style={styles.headerSubtitle}>Upload and analyze your statements</Text>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: Platform.OS === 'android' }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.content}>

          
          <View style={styles.comingSoonContainer}>
            <View style={styles.iconWrapper}>
              <Ionicons name="rocket-outline" size={32} color={colors.primary} />
            </View>
            <View style={styles.comingSoonContent}>
              <Text style={styles.comingSoonTitle}>Coming Soon!</Text>
              <Text style={styles.comingSoonText}>
                We're building powerful AI-driven analysis tools for your bank statements. Get ready for smarter financial insights.
              </Text>
            </View>
          </View>
          
          <View style={styles.featuresList}>
            <Text style={styles.featuresTitle}>What's Coming</Text>
            
            <View style={styles.featureGrid}>
              {[
                {icon: 'analytics', text: 'Smart Statement Analysis'},
                {icon: 'layers', text: 'Auto-Categorization'},
                {icon: 'trending-up', text: 'Spending Insights'},
                {icon: 'bulb', text: 'Smart Recommendations'},
                {icon: 'pie-chart', text: 'Visual Reports'},
                {icon: 'shield-checkmark', text: 'Security Features'}
              ].map((feature, index) => (
                <View key={index} style={styles.featureCard}>
                  <View style={styles.featureIconContainer}>
                    <Ionicons name={feature.icon as any} size={24} color={colors.primary} />
                  </View>
                  <Text style={styles.featureCardText}>{feature.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');
const cardWidth = (width - (spacing.md * 3) - 32) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: spacing.sm,
    padding: spacing.xs,
  },
  headerTitle: {
    ...textStyles.h2,
    color: colors.primary,
  },
  headerSubtitle: {
    ...textStyles.body2,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.md,
  },
  comingSoonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    marginVertical: spacing.md,
  },
  iconWrapper: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.round,
  },
  comingSoonContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  comingSoonTitle: {
    ...textStyles.h3,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  comingSoonText: {
    ...textStyles.body1,
    color: colors.primary,
  },
  featuresList: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.md,
  },
  featuresTitle: {
    ...textStyles.h3,
    marginBottom: spacing.md,
    color: colors.text,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: cardWidth,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureIconContainer: {
    backgroundColor: colors.primaryLight,
    padding: spacing.sm,
    borderRadius: borderRadius.round,
    marginBottom: spacing.sm,
  },
  featureCardText: {
    ...textStyles.body2,
    textAlign: 'center',
    color: colors.text,
  },
});

export default BankStatementsScreen;