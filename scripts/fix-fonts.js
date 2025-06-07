const fs = require('fs');
const path = require('path');

/**
 * This script copies font files to the assets/fonts directory at the root level
 * to make them more accessible for Expo. This can help resolve font loading issues.
 */

// Source font directories
const fontDirs = [
  path.join(__dirname, '../assets/fonts/Urbanist/static')
];


const destDir = path.join(__dirname, '../assets/fonts/flat');


if (!fs.existsSync(destDir)) {
  console.log(`Creating directory: ${destDir}`);
  fs.mkdirSync(destDir, { recursive: true });
}


let copiedFiles = 0;
fontDirs.forEach(sourceDir => {
  if (fs.existsSync(sourceDir)) {
    const files = fs.readdirSync(sourceDir);
    
    files.forEach(file => {
      if (file.endsWith('.ttf') || file.endsWith('.otf')) {
        const sourcePath = path.join(sourceDir, file);
        const destPath = path.join(destDir, file);
        
        try {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`Copied: ${file}`);
          copiedFiles++;
        } catch (err) {
          console.error(`Error copying ${file}: ${err.message}`);
        }
      }
    });
  } else {
    console.warn(`Source directory not found: ${sourceDir}`);
  }
});

console.log(`\nCopied ${copiedFiles} font files to ${destDir}`);


const fontProviderPath = path.join(__dirname, '../components/FontProvider.tsx');
const fontProviderContent = `import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import * as Font from 'expo-font';
import { Asset } from 'expo-asset';

// Define the props for the FontProvider component
interface FontProviderProps {
  children: React.ReactNode;
  onFontLoadingComplete: (success: boolean) => void;
}

// Define the fonts to load with flattened paths
const fontsToLoad = {
  "Urbanist-Black": require("../assets/fonts/flat/Urbanist-Black.ttf"),
  "Urbanist-Medium": require("../assets/fonts/flat/Urbanist-Medium.ttf"),
  "Urbanist-Regular": require("../assets/fonts/flat/Urbanist-Regular.ttf"),
  "Urbanist-Bold": require("../assets/fonts/flat/Urbanist-Bold.ttf"),
  "Urbanist-Light": require("../assets/fonts/flat/Urbanist-Light.ttf"),
  "Urbanist-BlackItalic": require("../assets/fonts/flat/Urbanist-BlackItalic.ttf"),
  "Urbanist-Italic": require("../assets/fonts/flat/Urbanist-Italic.ttf"),
  "Urbanist-SemiBold": require("../assets/fonts/flat/Urbanist-SemiBold.ttf"),
  "Urbanist-ExtraBold": require("../assets/fonts/flat/Urbanist-ExtraBold.ttf"),
  "Urbanist-MediumItalic": require("../assets/fonts/flat/Urbanist-MediumItalic.ttf"),
};

const FontProvider: React.FC<FontProviderProps> = ({ children, onFontLoadingComplete }) => {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  
  useEffect(() => {
    // Attempt to load fonts with multiple strategies and fallbacks
    const loadFonts = async () => {
      try {
        console.log('[FontProvider] Starting font loading process');
        
        try {
          // Try loading fonts directly first - the standard approach
          await Font.loadAsync(fontsToLoad);
          console.log('[FontProvider] Fonts loaded successfully with primary method');
          setFontsLoaded(true);
          onFontLoadingComplete(true);
          return;
        } catch (primaryError) {
          console.warn('[FontProvider] Primary font loading method failed:', primaryError);
          
          // If the first method fails, try pre-loading the assets
          try {
            // Pre-download each font asset
            const fontAssets = Object.values(fontsToLoad).map(source => Asset.fromModule(source));
            await Promise.all(fontAssets.map(asset => asset.downloadAsync()));
            
            // Try loading fonts again after pre-downloading
            await Font.loadAsync(fontsToLoad);
            console.log('[FontProvider] Fonts loaded successfully with fallback method');
            setFontsLoaded(true);
            onFontLoadingComplete(true);
            return;
          } catch (fallbackError) {
            console.error('[FontProvider] Fallback font loading method failed:', fallbackError);
            
            // All methods failed, continue without custom fonts
            console.warn('[FontProvider] Continuing without custom fonts');
            setFontsLoaded(false);
            onFontLoadingComplete(false);
          }
        }
      } catch (error) {
        console.error('[FontProvider] Font loading error:', error);
        setFontsLoaded(false);
        onFontLoadingComplete(false);
      }
    };

    // Add a timeout to ensure we don't wait indefinitely for fonts
    const timeoutId = setTimeout(() => {
      if (!fontsLoaded) {
        console.warn('[FontProvider] Font loading timeout - proceeding without custom fonts');
        setFontsLoaded(false);
        onFontLoadingComplete(false);
      }
    }, 5000); // 5 second timeout
    
    loadFonts();
    
    return () => clearTimeout(timeoutId);
  }, [onFontLoadingComplete]);
  
  return <>{children}</>;
};

export default FontProvider;`;

try {
  fs.writeFileSync(fontProviderPath, fontProviderContent);
  console.log(`\nUpdated FontProvider.tsx with flattened font paths`);
} catch (err) {
  console.error(`Error updating FontProvider.tsx: ${err.message}`);
}


const packageJsonPath = path.join(__dirname, '../package.json');
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  

  if (!packageJson.scripts['fix-fonts']) {
    packageJson.scripts['fix-fonts'] = 'node ./scripts/fix-fonts.js';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`Added 'fix-fonts' script to package.json`);
  }
  
  console.log(`\n✅ Font fix complete! Run 'npm run fix-fonts' anytime you have font loading issues.`);
  console.log(`\nRestart your Expo development server for changes to take effect.`);
} catch (err) {
  console.error(`Error updating package.json: ${err.message}`);
} 