import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, textStyles } from '../utils/theme';

const ExpenseScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Expense Screen</Text>
      <Text style={styles.subtext}>Coming soon...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  text: {
    ...textStyles.heading2,
    marginBottom: 10,
  },
  subtext: {
    ...textStyles.body,
    color: colors.textSecondary,
  },
});

export default ExpenseScreen; 