'use client';

/**
 * ThemePicker - System/Light/Dark + Ocean/Violet color palettes
 *
 * Store palette in localStorage and apply via CSS variables
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Check, Laptop, Moon, Palette, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

type ColorPalette = 'default' | 'ocean' | 'violet' | 'forest' | 'sunset';

interface PaletteConfig {
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

const palettes: Record<ColorPalette, PaletteConfig> = {
  default: {
    name: 'Default',
    description: 'Classic neutral theme',
    colors: {
      primary: '222.2 47.4% 11.2%',
      secondary: '210 40% 96.1%',
      accent: '210 40% 96.1%',
    },
  },
  ocean: {
    name: 'Ocean',
    description: 'Cool blue tones',
    colors: {
      primary: '199 89% 48%',
      secondary: '199 89% 96%',
      accent: '199 89% 92%',
    },
  },
  violet: {
    name: 'Violet',
    description: 'Purple elegance',
    colors: {
      primary: '262 83% 58%',
      secondary: '262 83% 96%',
      accent: '262 83% 92%',
    },
  },
  forest: {
    name: 'Forest',
    description: 'Natural green',
    colors: {
      primary: '142 71% 45%',
      secondary: '142 71% 96%',
      accent: '142 71% 92%',
    },
  },
  sunset: {
    name: 'Sunset',
    description: 'Warm orange',
    colors: {
      primary: '25 95% 53%',
      secondary: '25 95% 96%',
      accent: '25 95% 92%',
    },
  },
};

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [palette, setPalette] = useState<ColorPalette>('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load palette from localStorage
    const savedPalette = localStorage.getItem('color-palette') as ColorPalette;
    if (savedPalette && savedPalette in palettes) {
      setPalette(savedPalette);
      applyPalette(savedPalette);
    }
  }, []);

  const applyPalette = (newPalette: ColorPalette) => {
    const config = palettes[newPalette];
    const root = document.documentElement;

    root.style.setProperty('--primary', config.colors.primary);
    root.style.setProperty('--secondary', config.colors.secondary);
    root.style.setProperty('--accent', config.colors.accent);

    localStorage.setItem('color-palette', newPalette);
  };

  const handlePaletteChange = (newPalette: ColorPalette) => {
    setPalette(newPalette);
    applyPalette(newPalette);
  };

  if (!mounted) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          <CardTitle>Theme Settings</CardTitle>
        </div>
        <CardDescription>Customize your visual experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme Mode */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Theme Mode</Label>
          <RadioGroup value={theme} onValueChange={setTheme} className="grid grid-cols-3 gap-3">
            <div className="relative">
              <RadioGroupItem value="light" id="light" className="peer sr-only" />
              <Label
                htmlFor="light"
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
              >
                <Sun className="h-5 w-5" />
                <span className="text-sm font-medium">Light</span>
                {theme === 'light' && (
                  <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                )}
              </Label>
            </div>

            <div className="relative">
              <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
              <Label
                htmlFor="dark"
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
              >
                <Moon className="h-5 w-5" />
                <span className="text-sm font-medium">Dark</span>
                {theme === 'dark' && (
                  <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                )}
              </Label>
            </div>

            <div className="relative">
              <RadioGroupItem value="system" id="system" className="peer sr-only" />
              <Label
                htmlFor="system"
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
              >
                <Laptop className="h-5 w-5" />
                <span className="text-sm font-medium">System</span>
                {theme === 'system' && (
                  <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                )}
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Color Palette */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Color Palette</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(palettes).map(([key, config]) => (
              <Button
                key={key}
                variant="outline"
                className={`flex flex-col items-start h-auto p-3 relative ${
                  palette === key ? 'border-primary ring-2 ring-primary' : ''
                }`}
                onClick={() => handlePaletteChange(key as ColorPalette)}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="flex gap-1">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{
                        background: `hsl(${config.colors.primary})`,
                      }}
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{
                        background: `hsl(${config.colors.secondary})`,
                      }}
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{
                        background: `hsl(${config.colors.accent})`,
                      }}
                    />
                  </div>
                  {palette === key && <Check className="ml-auto h-4 w-4 text-primary" />}
                </div>
                <div className="mt-2 text-left">
                  <div className="font-medium text-sm">{config.name}</div>
                  <div className="text-xs text-muted-foreground">{config.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preview</Label>
          <div className="flex items-center gap-2 p-4 rounded-lg border bg-card">
            <Button size="sm">Primary</Button>
            <Button size="sm" variant="secondary">
              Secondary
            </Button>
            <Button size="sm" variant="outline">
              Outline
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
