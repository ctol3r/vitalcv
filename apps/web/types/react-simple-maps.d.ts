// Type shim for react-simple-maps@3 (no bundled .d.ts)
// Provides minimal ambient typings so the build passes without @types/react-simple-maps.
declare module 'react-simple-maps' {
  import type { ReactNode, MouseEvent, ComponentType, SVGProps } from 'react';

  export interface ComposableMapProps extends SVGProps<SVGSVGElement> {
    width?: number;
    height?: number;
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    style?: React.CSSProperties;
    className?: string;
    children?: ReactNode;
  }
  export const ComposableMap: ComponentType<ComposableMapProps>;

  export interface ZoomableGroupProps {
    zoom?: number;
    center?: [number, number];
    onMoveEnd?: (data: { zoom: number; coordinates: [number, number] }) => void;
    children?: ReactNode;
  }
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>;

  export interface GeographiesProps {
    geography: string | Record<string, unknown>;
    children: (data: { geographies: GeographyEntity[] }) => ReactNode;
  }
  export const Geographies: ComponentType<GeographiesProps>;

  export interface GeographyEntity {
    rsmKey: string;
    properties: Record<string, string | number>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }

  export interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: GeographyEntity;
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeWidth?: number;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
    };
    onClick?: (evt: MouseEvent) => void;
    onMouseEnter?: (evt: MouseEvent) => void;
    onMouseLeave?: (evt: MouseEvent) => void;
  }
  export const Geography: ComponentType<GeographyProps>;

  export interface MarkerProps extends SVGProps<SVGGElement> {
    coordinates: [number, number];
    onClick?: (evt: MouseEvent) => void;
    onMouseEnter?: (evt: MouseEvent) => void;
    onMouseLeave?: (evt: MouseEvent) => void;
    children?: ReactNode;
  }
  export const Marker: ComponentType<MarkerProps>;

  export interface LineProps extends SVGProps<SVGPathElement> {
    from: [number, number];
    to: [number, number];
    children?: ReactNode;
  }
  export const Line: ComponentType<LineProps>;

  export interface SphereProps extends SVGProps<SVGPathElement> {}
  export const Sphere: ComponentType<SphereProps>;

  export interface GraticuleProps extends SVGProps<SVGPathElement> {
    step?: [number, number];
  }
  export const Graticule: ComponentType<GraticuleProps>;
}
