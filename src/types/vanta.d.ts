declare module 'vanta/dist/vanta.clouds.min' {
  export interface VantaCloudsOptions {
    el: HTMLElement | string | null;
    THREE: any;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    scale?: number;
    scaleMobile?: number;
    speed?: number;
    skyColor?: number;
    cloudColor?: number;
    cloudShadowColor?: number;
    sunColor?: number;
    sunGlareColor?: number;
    sunlightColor?: number;
    backgroundColor?: number;
    backgroundAlpha?: number;
    mouseEase?: boolean;
    [key: string]: any;
  }

  export interface VantaEffect {
    destroy: () => void;
    resize: () => void;
    setOptions: (options: Partial<VantaCloudsOptions>) => void;
    renderer?: any;
    scene?: any;
    camera?: any;
    el?: HTMLElement;
    [key: string]: any;
  }

  const CLOUDS: (options: VantaCloudsOptions) => VantaEffect;
  export default CLOUDS;
}
