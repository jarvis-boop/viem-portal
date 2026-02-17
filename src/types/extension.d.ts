/**
 * Global type declarations for browser extension APIs
 */

interface ChromeRuntime {
  id: string;
  sendMessage(
    message: unknown,
    options?: unknown,
    responseCallback?: (response: unknown) => void
  ): void;
  onMessage: {
    addListener(
      callback: (
        message: unknown,
        sender: ChromeMessageSender,
        sendResponse: (response?: unknown) => void
      ) => void
    ): void;
    removeListener(
      callback: (
        message: unknown,
        sender: ChromeMessageSender,
        sendResponse: (response?: unknown) => void
      ) => void
    ): void;
  };
}

interface ChromeMessageSender {
  url?: string;
  tab?: ChromeTab;
}

interface ChromeTab {
  id?: number;
  title?: string;
  url?: string;
}

interface ChromeTabs {
  sendMessage(
    tabId: number,
    message: unknown,
    options?: unknown,
    responseCallback?: (response: unknown) => void
  ): void;
}

declare global {
  const chrome: {
    runtime: ChromeRuntime;
    tabs: ChromeTabs;
  };
}

export {};