import type { CoosyRendererApi } from "./coosy-api";

declare global {
  interface Window {
    coosy?: CoosyRendererApi;
  }
}

export {};
