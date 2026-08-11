/**
 * Castlabs ECS exposes `components` for Widevine CDM install.
 * Stock Electron typings omit this — declare the subset we use.
 */
declare module "electron" {
  export interface ComponentsStatus {
    [component: string]: unknown;
  }

  export const components: {
    whenReady: () => Promise<void>;
    status: () => ComponentsStatus;
  };
}

export {};
