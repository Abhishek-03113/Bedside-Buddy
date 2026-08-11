import type { CoosyApi } from "../preload/index";

declare global {
  interface Window {
    coosy?: CoosyApi;
  }
}

export {};
