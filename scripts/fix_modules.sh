#!/bin/bash
sed -i "" "s/com.tom_roush:pdfbox-android:1.8.9.1/com.tom-roush:pdfbox-android:2.0.27.0/g" node_modules/react-native-pdf-lib/android/build.gradle
echo "implementation \"androidx.annotation:annotation:1.7.1\"" >> node_modules/react-native-pdf-lib/android/build.gradle
echo "implementation \"androidx.core:core:1.12.0\"" >> node_modules/react-native-pdf-lib/android/build.gradle
sed -i "" -e "/flavorDimensions/,+10d" node_modules/react-native-iap/android/build.gradle
sed -i "" -e "s/playImplementation/implementation/g" -e "s/amazonImplementation/implementation/g" node_modules/react-native-iap/android/build.gradle
sed -i "" -e "s/android.support.v4.content.FileProvider/androidx.core.content.FileProvider/g" node_modules/react-native-pdf-lib/android/src/main/java/com/hopding/pdflib/PDFLibModule.java
sed -i "" -e "s/android.support.annotation.RequiresPermission/androidx.annotation.RequiresPermission/g" node_modules/react-native-pdf-lib/android/src/main/java/com/hopding/pdflib/factories/PDPageFactory.java
sed -i "" -e "/PDFBoxResourceLoader.init/d" node_modules/react-native-pdf-lib/android/src/main/java/com/hopding/pdflib/PDFLibModule.java
