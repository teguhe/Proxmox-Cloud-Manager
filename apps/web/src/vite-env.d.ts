/// <reference types="vite/client" />

declare module '@novnc/novnc' {
  export default class RFB {
    constructor(
      target: HTMLElement,
      url: string,
      options?: { credentials?: { password?: string } }
    );
    scaleViewport: boolean;
    resizeSession: boolean;
    sendCredentials(credentials: { password?: string }): void;
    addEventListener(event: string, cb: () => void): void;
    disconnect(): void;
  }
}
