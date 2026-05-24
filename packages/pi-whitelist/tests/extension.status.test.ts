import { describe, expect, it, vi, beforeEach } from 'vitest';
import whitelistExtension from '../src/extension.js';
import * as fs from 'node:fs';

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('whitelist mode status updates', () => {
  let commands: Record<string, any> = {};
  let lifecycleEvents: Record<string, any> = {};
  let shortcuts: Record<string, any> = {};
  let uiMock: any;
  let piMock: any;
  let ctxMock: any;

  beforeEach(() => {
    commands = {};
    lifecycleEvents = {};
    shortcuts = {};
    uiMock = { setStatus: vi.fn(), notify: vi.fn() };
    ctxMock = { ui: uiMock, hasUI: true };
    piMock = {
      getFlag: vi.fn().mockReturnValue(undefined),
      on: vi.fn().mockImplementation((event, handler) => {
        lifecycleEvents[event] = handler;
      }),
      registerCommand: vi.fn().mockImplementation((name, cmd) => {
        commands[name] = cmd;
      }),
      registerShortcut: vi.fn().mockImplementation((shortcut, options) => {
        shortcuts[shortcut] = options;
      }),
    };
    vi.clearAllMocks();
  });

  it('session_start initializes status', async () => {
    await whitelistExtension(piMock as any);
    expect(uiMock.setStatus).not.toHaveBeenCalled();

    lifecycleEvents['session_start']({}, ctxMock);
    
    expect(uiMock.setStatus).toHaveBeenCalledWith('whitelist-mode', 'mode default', { dim: true });
  });

  it('no-UI contexts guard status updates and do not crash', async () => {
    await whitelistExtension(piMock as any);
    const noUiCtx = { hasUI: false };

    // Should not throw
    lifecycleEvents['session_start']({}, noUiCtx);
    await commands['whitelist'].handler('mode auto', noUiCtx);
    await shortcuts['ctrl+shift+m'].handler(noUiCtx);

    expect(uiMock.setStatus).not.toHaveBeenCalled();
  });

  it('every mode switch updates status', async () => {
    await whitelistExtension(piMock as any);
    
    await commands['whitelist'].handler('mode auto', ctxMock);
    expect(uiMock.setStatus).toHaveBeenCalledWith('whitelist-mode', 'mode auto', { warning: true });

    await commands['whitelist'].handler('mode plan', ctxMock);
    expect(uiMock.setStatus).toHaveBeenCalledWith('whitelist-mode', 'mode plan', { accent: true });
    
    await shortcuts['ctrl+shift+m'].handler(ctxMock);
    expect(uiMock.setStatus).toHaveBeenCalledWith('whitelist-mode', 'mode bypass', { error: true, bold: true });
  });

  it('bypass label uses error and bold styling', async () => {
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('mode bypass', ctxMock);
    
    expect(uiMock.setStatus).toHaveBeenCalledWith('whitelist-mode', 'mode bypass', { error: true, bold: true });
  });

  it('status labels contain no emoji', async () => {
    await whitelistExtension(piMock as any);
    const order = ['default', 'auto', 'plan', 'bypass', 'default'];
    for (const mode of order) {
      if (mode === 'bypass') {
        await commands['whitelist'].handler('mode bypass', ctxMock);
      } else {
        await commands['whitelist'].handler(`mode ${mode}`, ctxMock);
      }
      
      const calls = uiMock.setStatus.mock.calls;
      const lastCallLabel = calls[calls.length - 1][1];
      // Basic regex check for standard emoji range
      expect(lastCallLabel).not.toMatch(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/);
    }
  });
});
